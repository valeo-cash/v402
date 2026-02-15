import { describe, it, expect } from "vitest";
import { getGatewayConfig } from "@v402pay/gateway/config";
import { checkPolicy, encryptMerchantKey, decryptMerchantKey } from "@v402pay/gateway";

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

describe("checkPolicy", () => {
  it("returns allowed when no policy exists (null)", () => {
    expect(checkPolicy(null, { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 0 })).toEqual({
      allowed: true,
    });
  });

  it("enforces max_spend_per_call — rejects when amount exceeds cap", () => {
    expect(
      checkPolicy(
        { max_spend_per_call: "5", max_spend_per_day: null, allowlisted_tool_ids: null, allowlisted_merchants: null },
        { amount: 10, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }
      )
    ).toEqual({ allowed: false, reason: "max_spend_per_call exceeded" });
  });

  it("enforces max_spend_per_day — rejects when dailySpend + amount exceeds cap", () => {
    expect(
      checkPolicy(
        { max_spend_per_call: null, max_spend_per_day: "100", allowlisted_tool_ids: null, allowlisted_merchants: null },
        { amount: 60, toolId: "t1", merchantWallet: "m1", dailySpend: 50 }
      )
    ).toEqual({ allowed: false, reason: "max_spend_per_day exceeded" });
  });

  it("enforces allowlisted_tool_ids — rejects unlisted tool", () => {
    expect(
      checkPolicy(
        { max_spend_per_call: null, max_spend_per_day: null, allowlisted_tool_ids: ["tool-a"], allowlisted_merchants: null },
        { amount: 1, toolId: "tool-b", merchantWallet: "m1", dailySpend: 0 }
      )
    ).toEqual({ allowed: false, reason: "tool not allowlisted" });
  });

  it("enforces allowlisted_merchants — rejects unlisted merchant", () => {
    expect(
      checkPolicy(
        { max_spend_per_call: null, max_spend_per_day: null, allowlisted_tool_ids: null, allowlisted_merchants: ["merchant-a"] },
        { amount: 1, toolId: "t1", merchantWallet: "merchant-b", dailySpend: 0 }
      )
    ).toEqual({ allowed: false, reason: "merchant not allowlisted" });
  });

  it("returns allowed when all checks pass", () => {
    expect(
      checkPolicy(
        { max_spend_per_call: "100", max_spend_per_day: "1000", allowlisted_tool_ids: ["t1"], allowlisted_merchants: ["m1"] },
        { amount: 5, toolId: "t1", merchantWallet: "m1", dailySpend: 0 }
      )
    ).toEqual({ allowed: true });
  });
});

describe("encryptMerchantKey / decryptMerchantKey", () => {
  const key = "a".repeat(64);

  it("round-trip: encrypt then decrypt returns original plaintext", () => {
    const plain = "secret-ed25519-private-key";
    const cipher = encryptMerchantKey(plain, key);
    expect(decryptMerchantKey(cipher, key)).toBe(plain);
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
});
