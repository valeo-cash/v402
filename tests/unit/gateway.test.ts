import { describe, it, expect } from "vitest";
import { getGatewayConfig } from "@v402pay/gateway/config";

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
