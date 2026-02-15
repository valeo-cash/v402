import { describe, it, expect } from "vitest";
import { canonicalToolMetadata } from "../tool-metadata.js";
import { signEd25519Message, verifyEd25519Message } from "../receipt.js";
import { randomBytes } from "crypto";
import * as ed from "@noble/ed25519";

describe("canonicalToolMetadata", () => {
  const input = {
    toolId: "tool-1",
    name: "Test Tool",
    description: "Desc",
    baseUrl: "https://api.example.com",
    pathPattern: "/pay",
    pricingModel: { per_call: 0.01 },
    acceptedCurrency: "USDC",
    merchantWallet: "So11111111111111111111111111111111111111112",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  it("is deterministic for same input", () => {
    expect(canonicalToolMetadata(input)).toBe(canonicalToolMetadata(input));
  });

  it("changes when any field changes", () => {
    const a = canonicalToolMetadata(input);
    expect(canonicalToolMetadata({ ...input, name: "Other" })).not.toBe(a);
    expect(canonicalToolMetadata({ ...input, toolId: "tool-2" })).not.toBe(a);
  });
});

describe("tool metadata signature verify", () => {
  it("sign then verify roundtrip with canonical payload", async () => {
    const seed = randomBytes(32);
    const pubKey = Buffer.from(await ed.getPublicKeyAsync(seed)).toString("hex");
    const input = {
      toolId: "t1",
      name: "N",
      description: "",
      baseUrl: "https://x.co",
      pathPattern: "/pay",
      pricingModel: {},
      acceptedCurrency: "USDC",
      merchantWallet: "So1xxx",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const canonical = canonicalToolMetadata(input);
    const sig = await signEd25519Message(canonical, seed);
    const ok = await verifyEd25519Message(canonical, sig, pubKey);
    expect(ok).toBe(true);
  });

  it("verification fails for tampered payload", async () => {
    const seed = randomBytes(32);
    const pubKey = Buffer.from(await ed.getPublicKeyAsync(seed)).toString("hex");
    const input = {
      toolId: "t1",
      name: "N",
      description: "",
      baseUrl: "https://x.co",
      pathPattern: "/pay",
      pricingModel: {},
      acceptedCurrency: "USDC",
      merchantWallet: "So1xxx",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const canonical = canonicalToolMetadata(input);
    const sig = await signEd25519Message(canonical, seed);
    const tampered = canonical.replace("t1", "t2");
    const ok = await verifyEd25519Message(tampered, sig, pubKey);
    expect(ok).toBe(false);
  });
});
