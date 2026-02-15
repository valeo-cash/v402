import { NextRequest, NextResponse } from "next/server";
import type { GatewayContext } from "../flow.js";
import { handleV402, completeWithReceipt } from "../flow.js";
import { RateLimitError } from "../rate-limit.js";

const INTENT_HEADER = "v402-intent";
const TX_HEADER = "v402-tx";
const REQUEST_HASH_HEADER = "v402-request-hash";

export type NextRouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap a Next.js App Router route handler with v402 gateway logic.
 * Buffer the request body so it can be hashed and forwarded unchanged.
 */
export function withV402Gateway(ctx: GatewayContext, handler: NextRouteHandler): NextRouteHandler {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const url = request.nextUrl ?? new URL(request.url);
    const intentId = request.headers.get(INTENT_HEADER) ?? undefined;
    const txSig = request.headers.get(TX_HEADER) ?? undefined;
    const requestHashHeader = request.headers.get(REQUEST_HASH_HEADER) ?? undefined;

    let body: string | Uint8Array = "";
    try {
      const raw = await request.arrayBuffer();
      if (raw.byteLength > 0) {
        body = new TextDecoder().decode(raw);
      }
    } catch {
      body = "";
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const incoming = {
      method: request.method,
      path: url.pathname || "/",
      query: Object.fromEntries(url.searchParams.entries()) as Record<string, string>,
      headers,
      body,
      contentType: request.headers.get("content-type") ?? undefined,
    };

    let result;
    try {
      result = await handleV402(ctx, incoming, intentId, txSig, requestHashHeader);
    } catch (err) {
      if (err instanceof RateLimitError) {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (err.retryAfter != null) headers["Retry-After"] = String(err.retryAfter);
        return new NextResponse(
          JSON.stringify({ error: err.message }),
          { status: 429, headers }
        );
      }
      return new NextResponse(
        JSON.stringify({ error: err instanceof Error ? err.message : "Gateway error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (result.type === "402") {
      return new NextResponse(JSON.stringify(result.intent), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "V402-Intent": result.intent.intentId,
        },
      });
    }

    if (result.type === "replay") {
      const res = new NextResponse(result.responseBody ?? "", {
        status: result.responseStatus,
        headers: new Headers(result.responseHeaders),
      });
      res.headers.set("V402-Receipt", JSON.stringify(result.receipt));
      return res;
    }

    const forwardedRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: body && typeof body === "string" ? body : request.body ?? undefined,
    });
    (forwardedRequest as NextRequest & { v402IntentId?: string; v402TxSig?: string; v402RequestHash?: string }).v402IntentId = result.intentId;
    (forwardedRequest as NextRequest & { v402TxSig?: string }).v402TxSig = result.txSig;
    (forwardedRequest as NextRequest & { v402RequestHash?: string }).v402RequestHash = requestHashHeader;

    const response = await handler(forwardedRequest, context);

    const intentIdFinal = (forwardedRequest as NextRequest & { v402IntentId?: string }).v402IntentId;
    const txSigFinal = (forwardedRequest as NextRequest & { v402TxSig?: string }).v402TxSig;
    const hashFinal = (forwardedRequest as NextRequest & { v402RequestHash?: string }).v402RequestHash;
    if (intentIdFinal && txSigFinal && hashFinal) {
      const status = response.status;
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        resHeaders[k.toLowerCase()] = v;
      });
      const responseBody = await response.text();
      try {
        const r = await completeWithReceipt(ctx, intentIdFinal, txSigFinal, hashFinal, status, resHeaders, responseBody);
        const newResponse = new NextResponse(responseBody, {
          status: response.status,
          headers: response.headers,
        });
        newResponse.headers.set("V402-Receipt", JSON.stringify(r.payload));
        return newResponse;
      } catch {
        return response;
      }
    }
    return response;
  };
}
