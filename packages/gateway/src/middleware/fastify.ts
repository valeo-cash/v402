import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import type { GatewayContext } from "../flow.js";
import { handleV402, completeWithReceipt } from "../flow.js";

const INTENT_HEADER = "v402-intent";
const TX_HEADER = "v402-tx";
const REQUEST_HASH_HEADER = "v402-request-hash";

function getBody(req: FastifyRequest): string | Uint8Array {
  const b = (req as FastifyRequest & { rawBody?: string | Buffer }).rawBody;
  if (b != null) return typeof b === "string" ? b : new Uint8Array(b);
  if (req.body != null) {
    if (typeof req.body === "string") return req.body;
    return JSON.stringify(req.body);
  }
  return "";
}

function getQuery(req: FastifyRequest): Record<string, string> {
  const q = req.query as Record<string, string | string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    out[k] = Array.isArray(v) ? v[0] ?? "" : v ?? "";
  }
  return out;
}

function getHeaders(req: FastifyRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null) out[k.toLowerCase()] = Array.isArray(v) ? v[0] ?? "" : v;
  }
  return out;
}

export async function v402GatewayFastify(
  ctx: GatewayContext,
  fastify: FastifyInstance
): Promise<void> {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body as string, "utf8");
      (req as FastifyRequest & { rawBody?: Buffer }).rawBody = buf;
      done(null, body);
    }
  );

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const intentId = request.headers[INTENT_HEADER] as string | undefined;
    const txSig = request.headers[TX_HEADER] as string | undefined;
    const requestHashHeader = request.headers[REQUEST_HASH_HEADER] as string | undefined;

    const incoming = {
      method: request.method,
      path: request.url.split("?")[0] || "/",
      query: getQuery(request),
      headers: getHeaders(request),
      body: getBody(request),
      contentType: request.headers["content-type"] as string | undefined,
    };

    try {
      const result = await handleV402(ctx, incoming, intentId, txSig, requestHashHeader);

      if (result.type === "402") {
        return reply.status(402).header("V402-Intent", result.intent.intentId).send(result.intent);
      }

      if (result.type === "replay") {
        for (const [k, v] of Object.entries(result.responseHeaders)) {
          reply.header(k, v);
        }
        reply.header("V402-Receipt", JSON.stringify(result.receipt));
        return reply.status(result.responseStatus).send(result.responseBody ?? "");
      }

      (request as FastifyRequest & { v402IntentId?: string; v402TxSig?: string; v402RequestHash?: string }).v402IntentId = result.intentId;
      (request as FastifyRequest & { v402TxSig?: string }).v402TxSig = result.txSig;
      (request as FastifyRequest & { v402RequestHash?: string }).v402RequestHash = requestHashHeader;
    } catch (err) {
      return reply.send(err);
    }
  });

  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    const intentId = (request as FastifyRequest & { v402IntentId?: string }).v402IntentId;
    const txSig = (request as FastifyRequest & { v402TxSig?: string }).v402TxSig;
    const hash = (request as FastifyRequest & { v402RequestHash?: string }).v402RequestHash;
    if (!intentId || !txSig || !hash) return payload;

    const status = reply.statusCode;
    const headers: Record<string, string> = {};
    reply.getHeaders();
    for (const [k, v] of Object.entries(reply.getHeaders())) {
      if (v != null) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] ?? "" : String(v);
    }
    const bodyStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    try {
      const r = await completeWithReceipt(ctx, intentId, txSig, hash, status, headers, bodyStr);
      reply.header("V402-Receipt", JSON.stringify(r.payload));
    } catch {
      // ignore
    }
    return payload;
  });
}
