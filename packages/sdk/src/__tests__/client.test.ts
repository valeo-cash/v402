import { describe, it, expect, vi, beforeEach } from "vitest";
import { createV402Client } from "../client.js";
import { V402PaymentError } from "../errors.js";

const mockPay = vi.fn();
const mockAdapter = {
  pay: mockPay,
  getPublicKey: async () => "Payer111111111111111111111111111111111",
};

const validIntent = {
  intentId: "i1",
  toolId: "t1",
  amount: "1",
  currency: "SOL",
  chain: "solana",
  recipient: "Recipient111111111111111111111111111",
  reference: "ref1",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  requestHash: "h1",
};

function mockFetch(responses: Response[]) {
  let i = 0;
  return vi.fn((_input: unknown, _init?: unknown) => Promise.resolve(responses[i++]));
}

describe("createV402Client", () => {
  beforeEach(() => {
    mockPay.mockReset();
  });

  it("throws INVALID_INTENT when 402 body is not JSON", async () => {
    const fetchFn = mockFetch([
      new Response("not json", { status: 402, headers: { "Content-Type": "text/plain" } }),
    ]);
    const { fetch: v402Fetch } = createV402Client({ walletAdapter: mockAdapter, fetch: fetchFn });

    let err: unknown;
    try {
      await v402Fetch("https://api.example.com/pay");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(V402PaymentError);
    expect((err as V402PaymentError).code).toBe("INVALID_INTENT");
    expect((err as Error).message).toContain("not JSON");
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("throws INTENT_EXPIRED for expired intent", async () => {
    const fetchFn = mockFetch([
      new Response(JSON.stringify({
        ...validIntent,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }), { status: 402, headers: { "Content-Type": "application/json" } }),
    ]);
    const { fetch: v402Fetch } = createV402Client({ walletAdapter: mockAdapter, fetch: fetchFn });

    let err: unknown;
    try {
      await v402Fetch("https://api.example.com/pay");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(V402PaymentError);
    expect((err as V402PaymentError).code).toBe("INTENT_EXPIRED");
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("throws INVALID_INTENT when required fields are missing", async () => {
    const fetchFn = mockFetch([
      new Response(JSON.stringify({
        intentId: "i1",
        // missing reference, recipient, amount
      }), { status: 402, headers: { "Content-Type": "application/json" } }),
    ]);
    const { fetch: v402Fetch } = createV402Client({ walletAdapter: mockAdapter, fetch: fetchFn });

    let err: unknown;
    try {
      await v402Fetch("https://api.example.com/pay");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(V402PaymentError);
    expect((err as V402PaymentError).code).toBe("INVALID_INTENT");
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("calls onBeforePay and aborts when it returns false", async () => {
    const fetchFn = mockFetch([
      new Response(JSON.stringify(validIntent), { status: 402, headers: { "Content-Type": "application/json" } }),
    ]);
    const onBeforePay = vi.fn().mockResolvedValue(false);
    const { fetch: v402Fetch } = createV402Client({
      walletAdapter: mockAdapter,
      fetch: fetchFn,
      onBeforePay,
    });

    let err: unknown;
    try {
      await v402Fetch("https://api.example.com/pay");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(V402PaymentError);
    expect((err as V402PaymentError).code).toBe("PAYMENT_FAILED");
    expect((err as Error).message).toContain("rejected");
    expect((err as Error).message).toContain("onBeforePay");
    expect(onBeforePay).toHaveBeenCalledWith(expect.objectContaining({ intentId: "i1" }));
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("happy path: 402 → pay succeeds → retry returns 200", async () => {
    const fetchFn = mockFetch([
      new Response(JSON.stringify(validIntent), { status: 402, headers: { "Content-Type": "application/json" } }),
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ]);
    mockPay.mockResolvedValue({ txSig: "5J7..." });

    const { fetch: v402Fetch } = createV402Client({ walletAdapter: mockAdapter, fetch: fetchFn });
    const res = await v402Fetch("https://api.example.com/pay");

    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(mockPay).toHaveBeenCalledWith(expect.objectContaining({
      recipient: validIntent.recipient,
      amount: validIntent.amount,
      currency: validIntent.currency,
      reference: validIntent.reference,
    }));
    const retryCall = fetchFn.mock.calls[1];
    expect(retryCall[1]?.headers?.get?.("V402-Intent")).toBe("i1");
    expect(retryCall[1]?.headers?.get?.("V402-Tx")).toBe("5J7...");
    expect(retryCall[1]?.headers?.get?.("V402-Request-Hash")).toBeDefined();
  });

  it("throws RETRY_FAILED when retry returns non-2xx", async () => {
    const fetchFn = mockFetch([
      new Response(JSON.stringify(validIntent), { status: 402, headers: { "Content-Type": "application/json" } }),
      new Response("Server error", { status: 500 }),
    ]);
    mockPay.mockResolvedValue({ txSig: "5J7..." });

    const { fetch: v402Fetch } = createV402Client({ walletAdapter: mockAdapter, fetch: fetchFn });

    let err: unknown;
    try {
      await v402Fetch("https://api.example.com/pay");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(V402PaymentError);
    expect((err as V402PaymentError).code).toBe("RETRY_FAILED");
    expect((err as Error).message).toContain("500");
  });

  it("throws PAYMENT_FAILED when walletAdapter.pay() throws", async () => {
    const fetchFn = mockFetch([
      new Response(JSON.stringify(validIntent), { status: 402, headers: { "Content-Type": "application/json" } }),
    ]);
    mockPay.mockRejectedValue(new Error("User rejected"));

    const { fetch: v402Fetch } = createV402Client({ walletAdapter: mockAdapter, fetch: fetchFn });

    let err: unknown;
    try {
      await v402Fetch("https://api.example.com/pay");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(V402PaymentError);
    expect((err as V402PaymentError).code).toBe("PAYMENT_FAILED");
    const cause = (err as V402PaymentError).cause;
    expect(cause).toBeDefined();
    expect(cause instanceof Error && cause.message).toBe("User rejected");
  });
});
