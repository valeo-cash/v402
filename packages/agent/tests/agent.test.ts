import { describe, it, expect, vi } from "vitest";
import { createAgent } from "@v402pay/agent";
import type { PaymentEvent, SpendingPolicy } from "@v402pay/agent";

function mockWallet() {
  return {
    pay: vi.fn().mockResolvedValue({ txSig: "mock-tx" }),
    getPublicKey: () => "mock-pubkey",
  };
}

function makePayment(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    toolName: "web_search",
    amount: 0.1,
    currency: "USDC",
    merchant: "merchant-a",
    intentId: `i-${Math.random().toString(36).slice(2)}`,
    txSignature: `tx-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    ...overrides,
  };
}

function defaultPolicy(overrides: Partial<SpendingPolicy> = {}): SpendingPolicy {
  return { dailyCap: 1.0, ...overrides };
}

// ---------------------------------------------------------------------------
// createAgent + canPay
// ---------------------------------------------------------------------------

describe("createAgent", () => {
  it("canPay returns true when within limits", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy(),
    });
    expect(agent.canPay(0.5)).toBe(true);
  });

  it("canPay returns false when daily cap would be exceeded", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({ dailyCap: 1.0 }),
    });
    agent.recordPayment(makePayment({ amount: 0.8 }));
    expect(agent.canPay(0.3)).toBe(false);
  });

  it("canPay returns false when per-call cap exceeded", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({ perCallCap: 0.05 }),
    });
    expect(agent.canPay(0.06)).toBe(false);
  });

  it("canPay returns false when tool not in allowedTools", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({
        allowedTools: ["web_search", "code_run"],
      }),
    });
    expect(agent.canPay(0.01, "hack_tool")).toBe(false);
  });

  it("canPay returns false when merchant not in allowedMerchants", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({
        allowedMerchants: ["merchant-a"],
      }),
    });
    expect(agent.canPay(0.01, undefined, "merchant-b")).toBe(false);
  });

  it("canPay returns false when policy expired", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const violations: Array<{ reason: string }> = [];
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({ expiry: yesterday }),
      onPolicyViolation: (v) => violations.push(v),
    });
    expect(agent.canPay(0.01)).toBe(false);
    expect(violations[0].reason).toBe("Policy expired");
  });

  // -----------------------------------------------------------------------
  // remainingBudget
  // -----------------------------------------------------------------------

  it("remainingBudget decreases after simulated payment tracking", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({ dailyCap: 1.0 }),
    });
    expect(agent.remainingBudget()).toBe(1.0);
    agent.recordPayment(makePayment({ amount: 0.3 }));
    expect(agent.remainingBudget()).toBeCloseTo(0.7);
    agent.recordPayment(makePayment({ amount: 0.2 }));
    expect(agent.remainingBudget()).toBeCloseTo(0.5);
  });

  // -----------------------------------------------------------------------
  // Daily reset
  // -----------------------------------------------------------------------

  it("daily reset: yesterdays payments do not count towards today's spend", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({ dailyCap: 1.0 }),
    });

    const yesterdayMs = Date.now() - 25 * 60 * 60 * 1000;
    agent.recordPayment(makePayment({ amount: 0.9, timestamp: yesterdayMs }));

    expect(agent.remainingBudget()).toBe(1.0);
    expect(agent.getStats().dailySpent).toBe(0);
    expect(agent.canPay(0.5)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // getStats
  // -----------------------------------------------------------------------

  it("getStats returns correct values", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy({ dailyCap: 5.0 }),
    });

    const yesterdayMs = Date.now() - 25 * 60 * 60 * 1000;
    agent.recordPayment(makePayment({ amount: 1.0, timestamp: yesterdayMs }));
    agent.recordPayment(makePayment({ amount: 0.5 }));
    agent.recordPayment(makePayment({ amount: 0.3 }));

    const stats = agent.getStats();
    expect(stats.dailyCap).toBe(5.0);
    expect(stats.dailySpent).toBeCloseTo(0.8);
    expect(stats.totalPayments).toBe(3);
    expect(stats.totalSpent).toBeCloseTo(1.8);
  });

  // -----------------------------------------------------------------------
  // getPaymentHistory
  // -----------------------------------------------------------------------

  it("getPaymentHistory returns all recorded payments", () => {
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy(),
    });

    agent.recordPayment(makePayment({ toolName: "t1", amount: 0.1 }));
    agent.recordPayment(makePayment({ toolName: "t2", amount: 0.2 }));
    agent.recordPayment(makePayment({ toolName: "t3", amount: 0.3 }));

    const history = agent.getPaymentHistory();
    expect(history).toHaveLength(3);
    expect(history.map((h) => h.toolName)).toEqual(["t1", "t2", "t3"]);
    expect(history.reduce((s, h) => s + h.amount, 0)).toBeCloseTo(0.6);
  });

  // -----------------------------------------------------------------------
  // Callbacks
  // -----------------------------------------------------------------------

  it("onPayment callback fires on recordPayment", () => {
    const events: PaymentEvent[] = [];
    const agent = createAgent({
      wallet: mockWallet(),
      spendingPolicy: defaultPolicy(),
      onPayment: (e) => events.push(e),
    });
    agent.recordPayment(makePayment({ amount: 0.1 }));
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(0.1);
  });

  it("exposes policy and wallet", () => {
    const wallet = mockWallet();
    const policy = defaultPolicy({ perCallCap: 0.5 });
    const agent = createAgent({ wallet, spendingPolicy: policy });
    expect(agent.policy).toBe(policy);
    expect(agent.wallet).toBe(wallet);
  });
});
