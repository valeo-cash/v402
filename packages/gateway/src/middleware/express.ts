import type { Request, Response, NextFunction } from "express";
import type { GatewayContext } from "../flow.js";
import { handleV402, completeWithReceipt } from "../flow.js";

const INTENT_HEADER = "v402-intent";
const TX_HEADER = "v402-tx";
const REQUEST_HASH_HEADER = "v402-request-hash";

function getBody(req: Request): string | Uint8Array {
  const b = (req as Request & { rawBody?: string | Buffer }).rawBody;
  if (b != null) return typeof b === "string" ? b : new Uint8Array(b);
  if (req.body != null) {
    if (typeof req.body === "string") return req.body;
    return JSON.stringify(req.body);
  }
  return "";
}

function getQuery(req: Request): Record<string, string> {
  const q = req.query as Record<string, string | string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    out[k] = Array.isArray(v) ? v[0] ?? "" : v ?? "";
  }
  return out;
}

function getHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null) out[k.toLowerCase()] = Array.isArray(v) ? v[0] ?? "" : v;
  }
  return out;
}

export function v402Gateway(ctx: GatewayContext) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const intentId = req.headers[INTENT_HEADER] as string | undefined;
    const txSig = req.headers[TX_HEADER] as string | undefined;
    const requestHashHeader = req.headers[REQUEST_HASH_HEADER] as string | undefined;

    const incoming: Parameters<typeof handleV402>[1] = {
      method: req.method,
      path: req.path,
      query: getQuery(req),
      headers: getHeaders(req),
      body: getBody(req),
      contentType: req.headers["content-type"] as string | undefined,
    };

    try {
      const result = await handleV402(
        ctx,
        incoming,
        intentId,
        txSig,
        requestHashHeader
      );

      if (result.type === "402") {
        res.status(402).set("V402-Intent", result.intent.intentId).json(result.intent);
        return;
      }

      if (result.type === "replay") {
        res.status(result.responseStatus);
        for (const [k, v] of Object.entries(result.responseHeaders)) {
          res.set(k, v);
        }
        res.set("V402-Receipt", JSON.stringify(result.receipt));
        res.send(result.responseBody ?? "");
        return;
      }

      (req as Request & { v402IntentId?: string; v402TxSig?: string; v402RequestHash?: string }).v402IntentId = result.intentId;
      (req as Request & { v402TxSig?: string }).v402TxSig = result.txSig;
      (req as Request & { v402RequestHash?: string }).v402RequestHash = requestHashHeader;

      const origSend = res.send.bind(res);
      res.send = function (body: unknown): Response {
        const status = res.statusCode;
        const headers = res.getHeaders() as Record<string, string>;
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        const intentId = (req as Request & { v402IntentId?: string }).v402IntentId;
        const txSig = (req as Request & { v402TxSig?: string }).v402TxSig;
        const hash = (req as Request & { v402RequestHash?: string }).v402RequestHash;
        if (intentId && txSig && hash) {
          completeWithReceipt(ctx, intentId, txSig, hash, status, headers, bodyStr)
            .then((r) => {
              res.set("V402-Receipt", JSON.stringify(r.payload));
              origSend(body);
            })
            .catch((err) => {
              next(err);
            });
        } else {
          origSend(body);
        }
        return res;
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Express body parser that preserves raw body for hashing. Use before v402Gateway.
 */
export function rawBodyParser(
  req: Request,
  res: Response,
  buf: Buffer,
  encoding: string
): void {
  (req as Request & { rawBody?: Buffer }).rawBody = buf;
}
