import { buildCanonicalRequest, requestHash, type PaymentIntent } from "@v402pay/core";
import type { V402WalletAdapter } from "./wallet/adapter.js";
import { intentToPayParams } from "./wallet/adapter.js";
import { V402PaymentError } from "./errors.js";

const INTENT_HEADER = "V402-Intent";
const TX_HEADER = "V402-Tx";
const REQUEST_HASH_HEADER = "V402-Request-Hash";

export type V402ClientOptions = {
  fetch?: typeof globalThis.fetch;
  walletAdapter: V402WalletAdapter;
  payerPublicKey?: string;
  /** Timeout in ms for the payment step (default: no timeout). */
  paymentTimeout?: number;
  /** Hook called before walletAdapter.pay(). Return false to abort (e.g. spend limits, user confirm). */
  onBeforePay?: (intent: PaymentIntent) => boolean | Promise<boolean>;
};

export type V402ClientFetchOptions = RequestInit & {
  body?: string | Record<string, unknown> | undefined;
  contentType?: string;
};

/**
 * Create a fetch wrapper that on 402: parses intent, runs client-side checks,
 * calls walletAdapter.pay(), then retries with V402-Intent, V402-Tx, V402-Request-Hash.
 */
export function createV402Client(options: V402ClientOptions) {
  const fetchFn = options.fetch ?? globalThis.fetch;

  async function v402Fetch(
    input: RequestInfo | URL,
    init?: V402ClientFetchOptions
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url);
    const method = init?.method ?? "GET";
    const query: Record<string, string> = {};
    parsed.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    const rawHeaders = init?.headers;
    const contentType =
      init?.contentType ??
      (rawHeaders instanceof Headers
        ? rawHeaders.get("content-type") ?? undefined
        : rawHeaders && typeof rawHeaders === "object"
          ? (Object.entries(rawHeaders as Record<string, string>).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? undefined)
          : undefined);
    let body: string | Uint8Array | undefined;
    if (init?.body !== undefined) {
      body =
        typeof init.body === "string"
          ? init.body
          : typeof init.body === "object" && init.body !== null && !(init.body instanceof ArrayBuffer)
          ? JSON.stringify(init.body)
          : (init.body as unknown as string);
    }
    const path = parsed.pathname || "/";
    const canonical = buildCanonicalRequest({
      method,
      path,
      query: Object.keys(query).length ? query : undefined,
      body,
      contentType,
    });
    const hash = requestHash(canonical);

    const headers = new Headers(init?.headers);
    const first = await fetchFn(input, {
      ...init,
      headers,
      body: init?.body as BodyInit | undefined,
    });

    if (first.status !== 402) return first;

    let intent: PaymentIntent;
    try {
      const json = await first.json();
      intent = json as PaymentIntent;
    } catch {
      throw new V402PaymentError("Invalid 402 response: not JSON", "INVALID_INTENT");
    }

    if (!intent.intentId || !intent.reference || !intent.recipient || !intent.amount) {
      throw new V402PaymentError(
        `Invalid intent: missing required fields (intentId=${intent.intentId ?? "missing"})`,
        "INVALID_INTENT"
      );
    }

    const expiresAt = new Date(intent.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      throw new V402PaymentError(
        `Intent ${intent.intentId} expired at ${intent.expiresAt}`,
        "INTENT_EXPIRED"
      );
    }

    if (options.onBeforePay) {
      const proceed = await Promise.resolve(options.onBeforePay(intent));
      if (!proceed) {
        throw new V402PaymentError(
          `Payment rejected by onBeforePay for intent ${intent.intentId}`,
          "PAYMENT_FAILED"
        );
      }
    }

    const payParams = intentToPayParams(intent);
    let txSig: string;
    try {
      const payPromise = options.walletAdapter.pay(payParams);
      const resolved =
        options.paymentTimeout != null
          ? await Promise.race([
              payPromise,
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Payment timed out after ${options.paymentTimeout}ms`)),
                  options.paymentTimeout
                )
              ),
            ])
          : await payPromise;
      txSig = resolved.txSig;
    } catch (err) {
      throw new V402PaymentError(
        `Payment failed for intent ${intent.intentId}: ${err instanceof Error ? err.message : String(err)}`,
        "PAYMENT_FAILED",
        err
      );
    }

    headers.set(INTENT_HEADER, intent.intentId);
    headers.set(TX_HEADER, txSig);
    headers.set(REQUEST_HASH_HEADER, hash);

    const retryRes = await fetchFn(input, {
      ...init,
      headers,
      body: init?.body as BodyInit | undefined,
    });

    if (retryRes.status < 200 || retryRes.status >= 300) {
      throw new V402PaymentError(
        `Retry after payment returned ${retryRes.status} for intent ${intent.intentId}`,
        "RETRY_FAILED",
        retryRes
      );
    }

    return retryRes;
  }

  return { fetch: v402Fetch };
}
