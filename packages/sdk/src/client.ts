import { buildCanonicalRequest, requestHash, type PaymentIntent } from "@v402pay/core";
import type { V402WalletAdapter } from "./wallet/adapter.js";
import { intentToPayParams } from "./wallet/adapter.js";

const INTENT_HEADER = "V402-Intent";
const TX_HEADER = "V402-Tx";
const REQUEST_HASH_HEADER = "V402-Request-Hash";

export type V402ClientOptions = {
  fetch?: typeof globalThis.fetch;
  walletAdapter: V402WalletAdapter;
  payerPublicKey?: string;
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
    const contentType = init?.contentType ?? (init?.headers as Record<string, string> | undefined)?.["content-type"];
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
      return first;
    }

    if (!intent.intentId || !intent.reference || !intent.recipient || !intent.amount) {
      return first;
    }

    const expiresAt = new Date(intent.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      return new Response(JSON.stringify({ error: "Intent expired" }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payParams = intentToPayParams(intent);
    const { txSig } = await options.walletAdapter.pay(payParams);

    headers.set(INTENT_HEADER, intent.intentId);
    headers.set(TX_HEADER, txSig);
    headers.set(REQUEST_HASH_HEADER, hash);

    return fetchFn(input, {
      ...init,
      headers,
      body: init?.body as BodyInit | undefined,
    });
  }

  return { fetch: v402Fetch };
}
