import { describe, it, expect } from "vitest";
import { getGatewayConfig } from "@v402pay/gateway/config";
import { checkPolicy, checkToolPolicy, checkSessionAllowed, encryptMerchantKey, decryptMerchantKey } from "@v402pay/gateway";

// ---------------------------------------------------------------------------
// getGatewayConfig
// ---------------------------------------------------------------------------

describe("getGatewayConfig", () => {
  it("throws when neither Cloud nor Supabase env is set", () => {
    expect(() => getGatewayConfig({})).toThrow("Gateway requires either");
  });

  it("accepts V402_API_KEY (Cloud mode) without Supabase", () => {
    const config = getGatewayConfig({
      V402_API_KEY: "ck_test_xxx",
    });
    expect(config.v402ApiKey).toBe("ck_test_xxx");
    expect(config.v402CloudUrl).toBe("https://api.v402pay.com");
  });

  it("uses V402_CLOUD_URL when set", () => {
    const config = getGatewayConfig({
      V402_API_KEY: "ck_test_xxx",
      V402_CLOUD_URL: "https://custom.cloud/v402",
    });
    expect(config.v402CloudUrl).toBe("https://custom.cloud/v402");
  });

  it("accepts full Supabase env when no V402_API_KEY", () => {
    const config = getGatewayConfig({
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "key",
      SOLANA_RPC_URL: "https://rpc.example",
      USDC_MINT: "mint",
      ENCRYPTION_KEY: "a".repeat(64),
    });
    expect(config.v402ApiKey).toBeUndefined();
    expect(config.supabaseUrl).toBe("https://supabase.example");
  });
});

// ---------------------------------------------------------------------------
// checkPolicy — comprehensive
// ---------------------------------------------------------------------------

describe("checkPolicy", () => {
  const fullPolicy = {
    max_spend_per_call: null as string | null,
    max_spend_per_day: null as string | null,
    allowlisted_tool_ids: null as string[] | null,
    allowlisted_merchants: null as string[] | null,
  };

  it("returns allowed when no policy exists (null)", () => {
    expect(checkPolicy(null, { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 0 })).toEqual({
      allowed: true,
    });
  });

  // --- max_spend_per_call ---

  it("max_spend_per_call: amount exactly at limit → allowed", () => {
    const policy = { ...fullPolicy, max_spend_per_call: "10" };
    expect(
      checkPolicy(policy, { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  it("max_spend_per_call: amount below limit → allowed", () => {
    const policy = { ...fullPolicy, max_spend_per_call: "10" };
    expect(
      checkPolicy(policy, { amount: 5, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  it("max_spend_per_call: amount $0.01 over → rejected", () => {
    const policy = { ...fullPolicy, max_spend_per_call: "5" };
    expect(
      checkPolicy(policy, { amount: 5.01, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "max_spend_per_call exceeded" });
  });

  it("max_spend_per_call: amount exceeds cap → rejected", () => {
    expect(
      checkPolicy(
        { ...fullPolicy, max_spend_per_call: "5" },
        { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 0 },
      ),
    ).toEqual({ allowed: false, reason: "max_spend_per_call exceeded" });
  });

  // --- max_spend_per_day ---

  it("max_spend_per_day: dailySpend + amount exactly at limit → allowed", () => {
    const policy = { ...fullPolicy, max_spend_per_day: "50" };
    expect(
      checkPolicy(policy, { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 40 }),
    ).toEqual({ allowed: true });
  });

  it("max_spend_per_day: dailySpend + amount $1 over → rejected", () => {
    const policy = { ...fullPolicy, max_spend_per_day: "50" };
    expect(
      checkPolicy(policy, { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 41 }),
    ).toEqual({ allowed: false, reason: "max_spend_per_day exceeded" });
  });

  it("max_spend_per_day: no prior spend, amount within cap → allowed", () => {
    const policy = { ...fullPolicy, max_spend_per_day: "100" };
    expect(
      checkPolicy(policy, { amount: 50, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  it("max_spend_per_day: no prior spend, amount exceeds cap → rejected", () => {
    const policy = { ...fullPolicy, max_spend_per_day: "100" };
    expect(
      checkPolicy(policy, { amount: 101, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "max_spend_per_day exceeded" });
  });

  // --- allowlisted_tool_ids ---

  it("allowlisted_tool_ids: tool in list → allowed", () => {
    const policy = { ...fullPolicy, allowlisted_tool_ids: ["web_search", "code_run"] };
    expect(
      checkPolicy(policy, { amount: 1, toolId: "web_search", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  it("allowlisted_tool_ids: tool not in list → rejected", () => {
    const policy = { ...fullPolicy, allowlisted_tool_ids: ["web_search", "code_run"] };
    expect(
      checkPolicy(policy, { amount: 1, toolId: "hack_tool", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "tool not allowlisted" });
  });

  it("allowlisted_tool_ids: empty array → allowed (no restriction)", () => {
    const policy = { ...fullPolicy, allowlisted_tool_ids: [] };
    expect(
      checkPolicy(policy, { amount: 1, toolId: "anything", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  // --- allowlisted_merchants ---

  it("allowlisted_merchants: merchant in list → allowed", () => {
    const policy = { ...fullPolicy, allowlisted_merchants: ["merchant-a", "merchant-b"] };
    expect(
      checkPolicy(policy, { amount: 1, toolId: "t1", merchantWallet: "merchant-a", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  it("allowlisted_merchants: merchant not in list → rejected", () => {
    const policy = { ...fullPolicy, allowlisted_merchants: ["merchant-a"] };
    expect(
      checkPolicy(policy, { amount: 1, toolId: "t1", merchantWallet: "merchant-b", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "merchant not allowlisted" });
  });

  it("allowlisted_merchants: empty array → allowed (no restriction)", () => {
    const policy = { ...fullPolicy, allowlisted_merchants: [] };
    expect(
      checkPolicy(policy, { amount: 1, toolId: "t1", merchantWallet: "anyone", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  // --- combined ---

  it("combined: all checks pass → allowed", () => {
    const policy = {
      max_spend_per_call: "100",
      max_spend_per_day: "1000",
      allowlisted_tool_ids: ["t1"],
      allowlisted_merchants: ["m1"],
    };
    expect(
      checkPolicy(policy, { amount: 5, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: true });
  });

  it("combined: per_call fails, rest pass → rejected", () => {
    const policy = {
      max_spend_per_call: "1",
      max_spend_per_day: "1000",
      allowlisted_tool_ids: ["t1"],
      allowlisted_merchants: ["m1"],
    };
    expect(
      checkPolicy(policy, { amount: 5, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "max_spend_per_call exceeded" });
  });

  it("combined: per_day fails, rest pass → rejected", () => {
    const policy = {
      max_spend_per_call: "100",
      max_spend_per_day: "50",
      allowlisted_tool_ids: ["t1"],
      allowlisted_merchants: ["m1"],
    };
    expect(
      checkPolicy(policy, { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 45 }),
    ).toEqual({ allowed: false, reason: "max_spend_per_day exceeded" });
  });

  it("combined: tool fails, rest pass → rejected", () => {
    const policy = {
      max_spend_per_call: "100",
      max_spend_per_day: "1000",
      allowlisted_tool_ids: ["t1"],
      allowlisted_merchants: ["m1"],
    };
    expect(
      checkPolicy(policy, { amount: 5, toolId: "t2", merchantWallet: "m1", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "tool not allowlisted" });
  });

  it("combined: merchant fails, rest pass → rejected", () => {
    const policy = {
      max_spend_per_call: "100",
      max_spend_per_day: "1000",
      allowlisted_tool_ids: ["t1"],
      allowlisted_merchants: ["m1"],
    };
    expect(
      checkPolicy(policy, { amount: 5, toolId: "t1", merchantWallet: "m2", dailySpend: 0 }),
    ).toEqual({ allowed: false, reason: "merchant not allowlisted" });
  });
});

// ---------------------------------------------------------------------------
// checkToolPolicy — tool-aware policy enforcement (v2)
// ---------------------------------------------------------------------------

describe("checkToolPolicy", () => {
  it("tool in allowlist → allowed", () => {
    expect(
      checkToolPolicy("web_search", { allowlisted_tool_ids: ["web_search", "code_run"] }),
    ).toEqual({ allowed: true });
  });

  it("tool not in allowlist → rejected", () => {
    expect(
      checkToolPolicy("hack_tool", { allowlisted_tool_ids: ["web_search", "code_run"] }),
    ).toEqual({ allowed: false, reason: 'Tool "hack_tool" not in allowlist' });
  });

  it("no allowlist set → allowed (permissive)", () => {
    expect(checkToolPolicy("anything", {})).toEqual({ allowed: true });
  });

  it("empty allowlist → allowed (permissive)", () => {
    expect(
      checkToolPolicy("anything", { allowlisted_tool_ids: [] }),
    ).toEqual({ allowed: true });
  });

  it("undefined tool_id → allowed", () => {
    expect(
      checkToolPolicy(undefined, { allowlisted_tool_ids: ["web_search"] }),
    ).toEqual({ allowed: true });
  });
});

// ---------------------------------------------------------------------------
// checkSessionAllowed — session billing (v2)
// ---------------------------------------------------------------------------

describe("checkSessionAllowed", () => {
  it("calls_used < max_calls → allowed", () => {
    expect(checkSessionAllowed({ max_calls: 10, calls_used: 3 })).toEqual({ allowed: true });
  });

  it("calls_used === 0, max_calls set → allowed", () => {
    expect(checkSessionAllowed({ max_calls: 5, calls_used: 0 })).toEqual({ allowed: true });
  });

  it("calls_used >= max_calls → rejected", () => {
    expect(checkSessionAllowed({ max_calls: 10, calls_used: 10 })).toEqual({
      allowed: false,
      reason: "Session call limit reached",
    });
  });

  it("calls_used > max_calls → rejected", () => {
    expect(checkSessionAllowed({ max_calls: 5, calls_used: 7 })).toEqual({
      allowed: false,
      reason: "Session call limit reached",
    });
  });

  it("max_calls null → allowed (no session limit)", () => {
    expect(checkSessionAllowed({ max_calls: null, calls_used: 100 })).toEqual({ allowed: true });
  });

  it("max_calls undefined → allowed (no session limit)", () => {
    expect(checkSessionAllowed({})).toEqual({ allowed: true });
  });

  it("calls_used null treated as 0 → allowed when max_calls > 0", () => {
    expect(checkSessionAllowed({ max_calls: 5, calls_used: null })).toEqual({ allowed: true });
  });
});

// ---------------------------------------------------------------------------
// encryptMerchantKey / decryptMerchantKey
// ---------------------------------------------------------------------------

describe("encryptMerchantKey / decryptMerchantKey", () => {
  const key = "a".repeat(64);

  it("round-trip: encrypt then decrypt returns original plaintext", () => {
    const plain = "secret-ed25519-private-key";
    const cipher = encryptMerchantKey(plain, key);
    expect(decryptMerchantKey(cipher, key)).toBe(plain);
  });

  it("round-trip with random-length plaintext", () => {
    const plain = "x".repeat(256);
    const cipher = encryptMerchantKey(plain, key);
    expect(decryptMerchantKey(cipher, key)).toBe(plain);
  });

  it("ciphertext differs on each call (random IV)", () => {
    const plain = "same-plaintext";
    const c1 = encryptMerchantKey(plain, key);
    const c2 = encryptMerchantKey(plain, key);
    expect(c1).not.toBe(c2);
    expect(decryptMerchantKey(c1, key)).toBe(plain);
    expect(decryptMerchantKey(c2, key)).toBe(plain);
  });

  it("decrypt with wrong key throws", () => {
    const plain = "secret";
    const cipher = encryptMerchantKey(plain, key);
    const wrongKey = "b".repeat(64);
    expect(() => decryptMerchantKey(cipher, wrongKey)).toThrow();
  });

  it("invalid ciphertext throws", () => {
    expect(() => decryptMerchantKey("not-valid-base64-or-too-short", key)).toThrow();
  });

  it("truncated ciphertext throws", () => {
    const plain = "secret";
    const cipher = encryptMerchantKey(plain, key);
    const truncated = cipher.slice(0, 10);
    expect(() => decryptMerchantKey(truncated, key)).toThrow();
  });

  it("ENCRYPTION_KEY must be 32-byte hex", () => {
    expect(() => encryptMerchantKey("test", "short")).toThrow("32-byte hex");
  });
});
