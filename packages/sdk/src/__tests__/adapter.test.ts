import { describe, it, expect } from "vitest";
import { intentToPayParams } from "../wallet/adapter.js";
import type { PaymentIntent } from "@v402pay/core";

describe("intentToPayParams", () => {
  const baseIntent: PaymentIntent = {
    intentId: "i1",
    toolId: "t1",
    amount: "1.5",
    currency: "USDC",
    chain: "solana",
    recipient: "Recipient111111111111111111111111111",
    reference: "ref1",
    expiresAt: new Date().toISOString(),
    requestHash: "abc",
  };

  it("maps required fields from PaymentIntent", () => {
    const params = intentToPayParams(baseIntent);
    expect(params.recipient).toBe(baseIntent.recipient);
    expect(params.amount).toBe(baseIntent.amount);
    expect(params.currency).toBe(baseIntent.currency);
    expect(params.reference).toBe(baseIntent.reference);
  });

  it("includes mint when present on intent", () => {
    const withMint: PaymentIntent = { ...baseIntent, mint: "EPjFWdd5..." };
    const params = intentToPayParams(withMint);
    expect(params.mint).toBe("EPjFWdd5...");
  });

  it("omits mint when not on intent", () => {
    const params = intentToPayParams(baseIntent);
    expect(params.mint).toBeUndefined();
  });
});
