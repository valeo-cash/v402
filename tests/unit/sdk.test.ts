import { describe, it, expect, vi } from "vitest";
import { createV402Client } from "@v402pay/sdk";
import type { PaymentIntent } from "@v402pay/core";

const mockIntent: PaymentIntent = {
  intentId: "int-1",
  toolId: "tool-1",
  amount: "0.01",
  currency: "USDC",
  chain: "solana",
  recipient: "recipient123",
  reference: "ref-abc",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  requestHash: "hash123",
};

describe("V402 client", () => {
  it("returns non-402 response as-is", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const adapter = {
      pay: vi.fn(),
    };
    const { fetch } = createV402Client({
      fetch: mockFetch,
      walletAdapter: adapter as any,
    });
    const res = await fetch("https://api.example.com/ok");
    expect(res.status).toBe(200);
    expect(adapter.pay).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("on 402: parses intent, calls walletAdapter.pay, then retries with proof headers", async () => {
    const txSig = "tx-signature-123";
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockIntent), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "V402-Receipt": "{}" },
        })
      );
    const adapter = {
      pay: vi.fn().mockResolvedValue({ txSig }),
    };
    const { fetch } = createV402Client({
      fetch: mockFetch,
      walletAdapter: adapter as any,
    });
    const res = await fetch("https://api.example.com/pay", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(adapter.pay).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: mockIntent.recipient,
        amount: mockIntent.amount,
        currency: mockIntent.currency,
        reference: mockIntent.reference,
      })
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryCall = mockFetch.mock.calls[1][1];
    expect(retryCall?.headers?.get?.("V402-Intent")).toBe(mockIntent.intentId);
    expect(retryCall?.headers?.get?.("V402-Tx")).toBe(txSig);
    expect(retryCall?.headers?.get?.("V402-Request-Hash")).toBeTruthy();
  });

  it("on 402 with expired intent returns 402 response", async () => {
    const expiredIntent: PaymentIntent = {
      ...mockIntent,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(expiredIntent), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      })
    );
    const adapter = { pay: vi.fn() };
    const { fetch } = createV402Client({
      fetch: mockFetch,
      walletAdapter: adapter as any,
    });
    const res = await fetch("https://api.example.com/pay");
    expect(res.status).toBe(402);
    expect(adapter.pay).not.toHaveBeenCalled();
  });
});
