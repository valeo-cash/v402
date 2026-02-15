import { describe, it, expect } from "vitest";
import {
  buildCanonicalRequest,
  stableStringify,
  requestHash,
  sha256Hex,
  signReceipt,
  verifyReceiptSignature,
  type ReceiptPayload,
} from "@v402pay/core";

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
    const seed = Buffer.from("a".repeat(64), "hex"); // 32 bytes
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
});
