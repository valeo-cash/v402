import { describe, it, expect, vi } from "vitest";
import { createV402Plugin } from "@v402pay/solana-agent-kit";
import type { V402PluginConfig } from "@v402pay/solana-agent-kit";

function mockSakAgent() {
  return {
    wallet: { publicKey: { toString: () => "MockPubkey123" } },
    connection: { rpcEndpoint: "https://api.devnet.solana.com" },
  } as Record<string, unknown>;
}

function defaultConfig(overrides: Partial<V402PluginConfig["spendingPolicy"]> = {}): V402PluginConfig {
  return {
    spendingPolicy: { dailyCap: 10, ...overrides },
  };
}

describe("createV402Plugin", () => {
  it("returns object with name, methods, and actions", () => {
    const plugin = createV402Plugin(defaultConfig());
    expect(plugin.name).toBe("v402-payments");
    expect(plugin.methods).toBeDefined();
    expect(plugin.actions).toBeDefined();
  });

  it("has 4 actions", () => {
    const plugin = createV402Plugin(defaultConfig());
    expect(plugin.actions).toHaveLength(4);
    const names = plugin.actions.map((a) => a.name);
    expect(names).toContain("V402_PAY_FOR_TOOL");
    expect(names).toContain("V402_CHECK_SPENDING_BUDGET");
    expect(names).toContain("V402_GET_PAYMENT_HISTORY");
    expect(names).toContain("V402_VERIFY_RECEIPT");
  });

  it("has 6 methods", () => {
    const plugin = createV402Plugin(defaultConfig());
    const methodNames = Object.keys(plugin.methods);
    expect(methodNames).toContain("v402PayForTool");
    expect(methodNames).toContain("v402CheckBudget");
    expect(methodNames).toContain("v402GetPaymentHistory");
    expect(methodNames).toContain("v402VerifyReceipt");
    expect(methodNames).toContain("v402CanPay");
    expect(methodNames).toContain("v402RemainingBudget");
    expect(methodNames).toHaveLength(6);
  });

  it("lazy-inits _v402Agent on the SAK agent", async () => {
    const plugin = createV402Plugin(defaultConfig());
    const agent = mockSakAgent();
    expect(agent._v402Agent).toBeUndefined();

    await plugin.methods.v402CheckBudget(agent);
    expect(agent._v402Agent).toBeDefined();
  });
});

describe("checkBudget", () => {
  it("returns correct stats", async () => {
    const plugin = createV402Plugin(defaultConfig({ dailyCap: 5, perCallCap: 1 }));
    const agent = mockSakAgent();

    const status = await plugin.methods.v402CheckBudget(agent);
    expect(status.dailyCap).toBe(5);
    expect(status.dailySpent).toBe(0);
    expect(status.remainingBudget).toBe(5);
    expect(status.totalPayments).toBe(0);
    expect(status.totalSpent).toBe(0);
    expect(status.policyExpired).toBe(false);
  });
});

describe("canPay", () => {
  it("returns true within limits", async () => {
    const plugin = createV402Plugin(defaultConfig({ dailyCap: 10 }));
    const agent = mockSakAgent();
    expect(await plugin.methods.v402CanPay(agent, 5)).toBe(true);
  });

  it("returns false when daily cap exceeded", async () => {
    const plugin = createV402Plugin(defaultConfig({ dailyCap: 1 }));
    const agent = mockSakAgent();

    await plugin.methods.v402PayForTool(agent, "t1", "0.8", "USDC", "merchant1");
    expect(await plugin.methods.v402CanPay(agent, 0.3)).toBe(false);
  });

  it("returns false for unlisted tool", async () => {
    const plugin = createV402Plugin(
      defaultConfig({ dailyCap: 10, allowedTools: ["web_search"] }),
    );
    const agent = mockSakAgent();
    expect(await plugin.methods.v402CanPay(agent, 0.01, "hack_tool")).toBe(false);
  });

  it("returns false for unlisted merchant", async () => {
    const plugin = createV402Plugin(
      defaultConfig({ dailyCap: 10, allowedMerchants: ["merchant-a"] }),
    );
    const agent = mockSakAgent();
    expect(await plugin.methods.v402CanPay(agent, 0.01, undefined, "merchant-b")).toBe(false);
  });

  it("returns false when policy expired", async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const plugin = createV402Plugin(
      defaultConfig({ dailyCap: 10, expiry: yesterday }),
    );
    const agent = mockSakAgent();
    expect(await plugin.methods.v402CanPay(agent, 0.01)).toBe(false);
  });
});

describe("payForTool", () => {
  it("returns error when policy blocks payment", async () => {
    const plugin = createV402Plugin(defaultConfig({ dailyCap: 0.5 }));
    const agent = mockSakAgent();

    await plugin.methods.v402PayForTool(agent, "t1", "0.4", "USDC", "m1");
    const res = await plugin.methods.v402PayForTool(agent, "t2", "0.2", "USDC", "m1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("spending policy");
  });

  it("records payment and updates budget", async () => {
    const plugin = createV402Plugin(defaultConfig({ dailyCap: 10 }));
    const agent = mockSakAgent();

    const res = await plugin.methods.v402PayForTool(agent, "web_search", "0.5", "USDC", "m1");
    expect(res.success).toBe(true);
    expect(res.amount).toBe("0.5");

    expect(await plugin.methods.v402RemainingBudget(agent)).toBeCloseTo(9.5);
  });
});

describe("getPaymentHistory", () => {
  it("returns empty array initially", async () => {
    const plugin = createV402Plugin(defaultConfig());
    const agent = mockSakAgent();

    const history = await plugin.methods.v402GetPaymentHistory(agent);
    expect(history.totalPayments).toBe(0);
    expect(history.payments).toEqual([]);
  });

  it("returns recorded payments", async () => {
    const plugin = createV402Plugin(defaultConfig({ dailyCap: 10 }));
    const agent = mockSakAgent();

    await plugin.methods.v402PayForTool(agent, "t1", "0.1", "USDC", "m1");
    await plugin.methods.v402PayForTool(agent, "t2", "0.2", "SOL", "m2");

    const history = await plugin.methods.v402GetPaymentHistory(agent);
    expect(history.totalPayments).toBe(2);
    expect(history.payments).toHaveLength(2);
    expect(history.payments[0].toolName).toBe("t1");
    expect(history.payments[1].toolName).toBe("t2");
  });
});

describe("default export", async () => {
  it("creates plugin with $1/day cap", async () => {
    const { default: defaultPlugin } = await import("@v402pay/solana-agent-kit");
    expect(defaultPlugin.name).toBe("v402-payments");
    const agent = mockSakAgent();
    const status = await defaultPlugin.methods.v402CheckBudget(agent);
    expect(status.dailyCap).toBe(1);
  });
});

describe("action schemas validate correctly", () => {
  it("V402_PAY_FOR_TOOL schema validates", () => {
    const plugin = createV402Plugin(defaultConfig());
    const action = plugin.actions.find((a) => a.name === "V402_PAY_FOR_TOOL")!;
    const result = action.schema.safeParse({
      toolId: "web_search",
      amount: "0.01",
      currency: "USDC",
      merchant: "SomeWallet123",
    });
    expect(result.success).toBe(true);
  });

  it("V402_PAY_FOR_TOOL schema rejects invalid currency", () => {
    const plugin = createV402Plugin(defaultConfig());
    const action = plugin.actions.find((a) => a.name === "V402_PAY_FOR_TOOL")!;
    const result = action.schema.safeParse({
      toolId: "t",
      amount: "1",
      currency: "ETH",
      merchant: "m",
    });
    expect(result.success).toBe(false);
  });
});
