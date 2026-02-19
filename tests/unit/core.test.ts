import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildCanonicalRequest,
  stableStringify,
  requestHash,
  sha256Hex,
  signReceipt,
  verifyReceiptSignature,
  verifySolanaPayment,
  parseAmount,
  SOL_DECIMALS,
  USDC_DECIMALS,
  type ReceiptPayload,
  type PaymentIntent,
} from "@v402pay/core";
import { safeParseDecimal } from "@v402pay/gateway";
import * as ed from "@noble/ed25519";

// ---------------------------------------------------------------------------
// Existing tests — canonicalization
// ---------------------------------------------------------------------------

describe("canonicalization", () => {
  it("stableStringify sorts object keys deterministically", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("buildCanonicalRequest joins method, path, query, body, content-type", () => {
    const out = buildCanonicalRequest({
      method: "GET",
      path: "/api/tool",
      contentType: "",
    });
    expect(out).toBe("GET\n/api/tool\n\n\n");
  });

  it("buildCanonicalRequest normalizes path and sorts query", () => {
    const out = buildCanonicalRequest({
      method: "GET",
      path: "/api/tool/",
      query: { b: "2", a: "1" },
      contentType: "",
    });
    expect(out).toContain("\n/api/tool\n");
    expect(out).toContain("a=1&b=2");
  });

  it("buildCanonicalRequest stable-stringifies JSON body", () => {
    const out = buildCanonicalRequest({
      method: "POST",
      path: "/",
      body: '{"z":1,"y":2}',
      contentType: "application/json",
    });
    expect(out).toContain('{"y":2,"z":1}');
  });
});

// ---------------------------------------------------------------------------
// Existing tests — hashing
// ---------------------------------------------------------------------------

describe("hashing", () => {
  it("sha256Hex returns 64-char lowercase hex", () => {
    const out = sha256Hex("hello");
    expect(out).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sha256Hex is deterministic", () => {
    expect(sha256Hex("same")).toBe(sha256Hex("same"));
  });

  it("requestHash hashes canonical request", () => {
    const h = requestHash("GET\n/api\n\n\n");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Existing + expanded tests — receipt signing and verification
// ---------------------------------------------------------------------------

describe("receipt signing and verification", () => {
  const payload: ReceiptPayload = {
    receiptId: "rec-1",
    intentId: "int-1",
    toolId: "tool-1",
    requestHash: "abc",
    responseHash: "def",
    txSig: "sig123",
    payer: "payer1",
    merchant: "merchant1",
    timestamp: new Date().toISOString(),
  };

  it("signReceipt returns base64 signature for 32-byte hex seed", async () => {
    const seed = Buffer.from("a".repeat(64), "hex");
    const sig = await signReceipt(payload, seed);
    expect(sig).toBeTruthy();
    expect(sig.length).toBeGreaterThan(0);
    expect(Buffer.from(sig, "base64").length).toBeGreaterThan(0);
  });

  it("verifyReceiptSignature returns false for wrong public key", async () => {
    const seed = Buffer.from("a".repeat(64), "hex");
    const sig = await signReceipt(payload, seed);
    const wrongPubHex = "b".repeat(64);
    const ok = await verifyReceiptSignature(payload, sig, wrongPubHex);
    expect(ok).toBe(false);
  });

  it("sign → verify round-trip with correct public key passes", async () => {
    const seed = Buffer.from("a".repeat(64), "hex");
    const sig = await signReceipt(payload, seed);

    const pubBytes = await Promise.resolve(ed.getPublicKey(seed));
    const pubHex = Buffer.from(pubBytes).toString("hex");

    const ok = await verifyReceiptSignature(payload, sig, pubHex);
    expect(ok).toBe(true);
  });

  it("tampered receipt data fails verification", async () => {
    const seed = Buffer.from("c".repeat(64), "hex");
    const sig = await signReceipt(payload, seed);
    const pubBytes = await Promise.resolve(ed.getPublicKey(seed));
    const pubHex = Buffer.from(pubBytes).toString("hex");

    const tampered: ReceiptPayload = { ...payload, payer: "evil-payer" };
    const ok = await verifyReceiptSignature(tampered, sig, pubHex);
    expect(ok).toBe(false);
  });

  it("sign with key A, verify with key B → fails", async () => {
    const seedA = Buffer.from("a".repeat(64), "hex");
    const seedB = Buffer.from("b".repeat(64), "hex");
    const sig = await signReceipt(payload, seedA);

    const pubB = await Promise.resolve(ed.getPublicKey(seedB));
    const pubHexB = Buffer.from(pubB).toString("hex");

    const ok = await verifyReceiptSignature(payload, sig, pubHexB);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifySolanaPayment
// ---------------------------------------------------------------------------

function makeIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    intentId: "int-test",
    toolId: "tool-test",
    amount: "1",
    currency: "SOL",
    chain: "solana",
    recipient: "recipientAddr",
    reference: "ref-test",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    requestHash: "abc",
    ...overrides,
  };
}

const verifyConfig = {
  rpcUrl: "https://rpc.test",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  commitment: "confirmed" as const,
};

function makeSolTx(opts: {
  payer: string;
  recipient: string;
  lamports: number;
  reference: string;
  blockTime?: number;
  err?: unknown;
}) {
  return {
    transaction: {
      message: {
        accountKeys: [{ pubkey: opts.payer }],
        instructions: [
          {
            programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
            data: `v402:${opts.reference}`,
          },
          {
            programId: "11111111111111111111111111111111",
            parsed: {
              type: "transfer",
              info: { destination: opts.recipient, lamports: opts.lamports },
            },
          },
        ],
      },
    },
    blockTime: opts.blockTime ?? Math.floor(Date.now() / 1000) - 10,
    meta: { err: opts.err ?? null },
  };
}

function makeUsdcTx(opts: {
  sourceOwner: string;
  destination: string;
  amount: string;
  reference: string;
  blockTime?: number;
  err?: unknown;
  mint?: string;
}) {
  return {
    transaction: {
      message: {
        accountKeys: [{ pubkey: opts.sourceOwner }],
        instructions: [
          {
            programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
            data: `v402:${opts.reference}`,
          },
          {
            programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            parsed: {
              type: "transfer",
              info: {
                destination: opts.destination,
                source: "src-token-acct",
                amount: opts.amount,
                mint: opts.mint,
                sourceOwner: opts.sourceOwner,
              },
            },
          },
        ],
      },
    },
    blockTime: opts.blockTime ?? Math.floor(Date.now() / 1000) - 10,
    meta: { err: opts.err ?? null },
  };
}

/** Stub globalThis.fetch with sequential RPC responses. */
function stubFetch(...responses: unknown[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ json: () => Promise.resolve(r) });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("verifySolanaPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("successful SOL transfer returns correct payer, amount, merchant", async () => {
    const intent = makeIntent({
      amount: "1",
      currency: "SOL",
      recipient: "merchantSOL",
      reference: "ref-sol-1",
    });
    const tx = makeSolTx({
      payer: "payerSOL",
      recipient: "merchantSOL",
      lamports: Number(parseAmount("1", SOL_DECIMALS)),
      reference: "ref-sol-1",
    });
    stubFetch({ result: tx });

    const result = await verifySolanaPayment("txSig1", intent, verifyConfig);
    expect(result.payer).toBe("payerSOL");
    expect(result.txSig).toBe("txSig1");
    expect(result.blockTime).toBe(tx.blockTime);
  });

  it("successful USDC/SPL transfer returns correct data", async () => {
    const intent = makeIntent({
      amount: "0.10",
      currency: "USDC",
      recipient: "merchant123",
      reference: "ref-usdc-1",
    });
    const tx = makeUsdcTx({
      sourceOwner: "payerUSDC",
      destination: "dest-ata-acct",
      amount: String(parseAmount("0.10", USDC_DECIMALS)),
      reference: "ref-usdc-1",
      mint: verifyConfig.usdcMint,
    });

    stubFetch(
      { result: tx },
      { result: { value: { data: { parsed: { info: { owner: "merchant123" } } } } } },
    );

    const result = await verifySolanaPayment("txSigUsdc", intent, verifyConfig);
    expect(result.payer).toBe("payerUSDC");
    expect(result.txSig).toBe("txSigUsdc");
  });

  it("failed tx (meta.err not null) throws", async () => {
    const intent = makeIntent({ reference: "ref-fail" });
    const tx = makeSolTx({
      payer: "p",
      recipient: "recipientAddr",
      lamports: 1_000_000_000,
      reference: "ref-fail",
      err: { InstructionError: [0, "Custom"] },
    });
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txFail", intent, verifyConfig)).rejects.toThrow(
      "Transaction failed",
    );
  });

  it("tx not found (null result) throws", async () => {
    const intent = makeIntent();
    stubFetch({ result: null });

    await expect(verifySolanaPayment("txMissing", intent, verifyConfig)).rejects.toThrow(
      "Transaction not found",
    );
  });

  it("RPC error throws", async () => {
    const intent = makeIntent();
    stubFetch({ result: null, error: { message: "server unavailable" } });

    await expect(verifySolanaPayment("txRpc", intent, verifyConfig)).rejects.toThrow(
      "RPC error: server unavailable",
    );
  });

  it("SOL amount too low throws", async () => {
    const intent = makeIntent({
      amount: "2",
      currency: "SOL",
      recipient: "merchantSOL",
      reference: "ref-low",
    });
    const tx = makeSolTx({
      payer: "p",
      recipient: "merchantSOL",
      lamports: 1_000_000_000, // 1 SOL, but intent asks for 2
      reference: "ref-low",
    });
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txLow", intent, verifyConfig)).rejects.toThrow(
      "SOL amount too low",
    );
  });

  it("wrong SOL recipient throws", async () => {
    const intent = makeIntent({
      amount: "1",
      currency: "SOL",
      recipient: "expectedRecipient",
      reference: "ref-wrong-recip",
    });
    const tx = makeSolTx({
      payer: "p",
      recipient: "differentRecipient",
      lamports: 1_000_000_000,
      reference: "ref-wrong-recip",
    });
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txWrong", intent, verifyConfig)).rejects.toThrow(
      "SOL transfer to recipient not found",
    );
  });

  it("USDC amount too low throws", async () => {
    const intent = makeIntent({
      amount: "1.00",
      currency: "USDC",
      recipient: "merchant",
      reference: "ref-usdc-low",
    });
    const tx = makeUsdcTx({
      sourceOwner: "payer",
      destination: "dest",
      amount: "500000", // 0.5 USDC — intent asks for 1.00
      reference: "ref-usdc-low",
      mint: verifyConfig.usdcMint,
    });
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txUsdcLow", intent, verifyConfig)).rejects.toThrow(
      "USDC amount too low",
    );
  });

  it("payer mismatch when intent.payer set throws", async () => {
    const intent = makeIntent({
      amount: "1",
      currency: "SOL",
      recipient: "merchantSOL",
      reference: "ref-payer-mm",
      payer: "expectedPayer",
    });
    const tx = makeSolTx({
      payer: "differentPayer",
      recipient: "merchantSOL",
      lamports: 1_000_000_000,
      reference: "ref-payer-mm",
    });
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txMM", intent, verifyConfig)).rejects.toThrow(
      "Payer mismatch",
    );
  });

  it("payer check passes when intent.payer matches derived payer", async () => {
    const intent = makeIntent({
      amount: "1",
      currency: "SOL",
      recipient: "merchantSOL",
      reference: "ref-payer-ok",
      payer: "correctPayer",
    });
    const tx = makeSolTx({
      payer: "correctPayer",
      recipient: "merchantSOL",
      lamports: 1_000_000_000,
      reference: "ref-payer-ok",
    });
    stubFetch({ result: tx });

    const result = await verifySolanaPayment("txOk", intent, verifyConfig);
    expect(result.payer).toBe("correctPayer");
  });

  it("missing memo throws", async () => {
    const intent = makeIntent({ reference: "ref-memo" });
    const tx = {
      transaction: {
        message: {
          accountKeys: [{ pubkey: "payer" }],
          instructions: [
            {
              programId: "11111111111111111111111111111111",
              parsed: { type: "transfer", info: { destination: "recipientAddr", lamports: 1_000_000_000 } },
            },
          ],
        },
      },
      blockTime: Math.floor(Date.now() / 1000) - 10,
      meta: { err: null },
    };
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txNoMemo", intent, verifyConfig)).rejects.toThrow(
      "Missing Memo instruction",
    );
  });

  it("expired intent throws", async () => {
    const intent = makeIntent({
      reference: "ref-exp",
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
    });
    const tx = makeSolTx({
      payer: "p",
      recipient: "recipientAddr",
      lamports: 1_000_000_000,
      reference: "ref-exp",
      blockTime: Math.floor(Date.now() / 1000),
    });
    stubFetch({ result: tx });

    await expect(verifySolanaPayment("txExp", intent, verifyConfig)).rejects.toThrow(
      "Transaction is after intent expiry",
    );
  });
});

// ---------------------------------------------------------------------------
// parseAmount — atomic-unit conversion
// ---------------------------------------------------------------------------

describe("parseAmount", () => {
  it('"0" → 0n', () => {
    expect(parseAmount("0", 6)).toBe(0n);
    expect(parseAmount("0", 9)).toBe(0n);
  });

  it('"0.000001" with 6 decimals → 1n', () => {
    expect(parseAmount("0.000001", 6)).toBe(1n);
  });

  it('"999999999.99" with 6 decimals → 999999999990000n', () => {
    expect(parseAmount("999999999.99", 6)).toBe(999999999990000n);
  });

  it('"1" SOL (9 decimals) → 1_000_000_000n', () => {
    expect(parseAmount("1", SOL_DECIMALS)).toBe(1_000_000_000n);
  });

  it('"0.50" USDC (6 decimals) → 500_000n', () => {
    expect(parseAmount("0.50", USDC_DECIMALS)).toBe(500_000n);
  });

  it('"abc" throws (BigInt rejects non-numeric)', () => {
    expect(() => parseAmount("abc", 6)).toThrow();
  });

  it('"NaN" throws', () => {
    expect(() => parseAmount("NaN", 6)).toThrow();
  });

  it('"Infinity" throws', () => {
    expect(() => parseAmount("Infinity", 6)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// safeParseDecimal — validation for policy amounts
// ---------------------------------------------------------------------------

describe("safeParseDecimal", () => {
  it('"0" → 0', () => {
    expect(safeParseDecimal("0")).toBe(0);
  });

  it('"0.000001" → 0.000001', () => {
    expect(safeParseDecimal("0.000001")).toBe(0.000001);
  });

  it('"999999999.99" → 999999999.99', () => {
    expect(safeParseDecimal("999999999.99")).toBe(999999999.99);
  });

  it('empty string "" throws', () => {
    expect(() => safeParseDecimal("")).toThrow("Invalid decimal amount");
  });

  it('"abc" throws', () => {
    expect(() => safeParseDecimal("abc")).toThrow("Invalid decimal amount");
  });

  it('"1.2.3" throws', () => {
    expect(() => safeParseDecimal("1.2.3")).toThrow("Invalid decimal amount");
  });

  it('"NaN" throws', () => {
    expect(() => safeParseDecimal("NaN")).toThrow("Invalid decimal amount");
  });

  it('"Infinity" throws', () => {
    expect(() => safeParseDecimal("Infinity")).toThrow("Invalid decimal amount");
  });

  it('negative "-1" throws (amounts must be positive)', () => {
    expect(() => safeParseDecimal("-1")).toThrow("Invalid decimal amount");
  });

  it('negative "-0.50" throws', () => {
    expect(() => safeParseDecimal("-0.50")).toThrow("Invalid decimal amount");
  });
});
