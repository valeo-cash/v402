import { describe, it, expect, vi } from "vitest";
import { SpendingTracker, createV402McpClient } from "@v402pay/mcp-client";

// ---------------------------------------------------------------------------
// SpendingTracker — unit tests
// ---------------------------------------------------------------------------

describe("SpendingTracker", () => {
  it("enforces per-call cap (rejects if tool costs too much)", () => {
    const tracker = new SpendingTracker({ perCallCap: 0.01 });
    expect(tracker.checkPolicy(0.01).allowed).toBe(true);
    expect(tracker.checkPolicy(0.02).allowed).toBe(false);
    expect(tracker.checkPolicy(0.02).reason).toContain("per-call cap");
  });

  it("enforces daily cap (rejects if over daily limit)", () => {
    const tracker = new SpendingTracker({ dailyCap: 1.0 });
    tracker.recordPayment({
      toolName: "t1",
      amount: 0.5,
      currency: "USDC",
      merchant: "m1",
      intentId: "i1",
      txSignature: "tx1",
      timestamp: Date.now(),
    });
    expect(tracker.checkPolicy(0.4).allowed).toBe(true);
    expect(tracker.checkPolicy(0.6).allowed).toBe(false);
    expect(tracker.checkPolicy(0.6).reason).toContain("daily cap");
  });

  it("enforces allowed tools (rejects unlisted tools)", () => {
    const tracker = new SpendingTracker({
      allowedTools: ["web_search", "code_run"],
    });
    expect(tracker.checkPolicy(0.01, "web_search").allowed).toBe(true);
    expect(tracker.checkPolicy(0.01, "hack_tool").allowed).toBe(false);
    expect(tracker.checkPolicy(0.01, "hack_tool").reason).toContain(
      "not in allowed list",
    );
  });

  it("enforces allowed merchants", () => {
    const tracker = new SpendingTracker({
      allowedMerchants: ["merchant-a"],
    });
    expect(
      tracker.checkPolicy(0.01, "any", "merchant-a").allowed,
    ).toBe(true);
    expect(
      tracker.checkPolicy(0.01, "any", "merchant-b").allowed,
    ).toBe(false);
  });

  it("tracks spending correctly across multiple calls", () => {
    const tracker = new SpendingTracker({ dailyCap: 1.0 });
    tracker.recordPayment({
      toolName: "t1",
      amount: 0.3,
      currency: "USDC",
      merchant: "m1",
      intentId: "i1",
      txSignature: "tx1",
      timestamp: Date.now(),
    });
    tracker.recordPayment({
      toolName: "t2",
      amount: 0.4,
      currency: "USDC",
      merchant: "m2",
      intentId: "i2",
      txSignature: "tx2",
      timestamp: Date.now(),
    });
    expect(tracker.getTodaySpend()).toBeCloseTo(0.7);
  });

  it("remainingBudget returns correct value after payments", () => {
    const tracker = new SpendingTracker({ dailyCap: 1.0 });
    expect(tracker.remainingBudget()).toBe(1.0);
    tracker.recordPayment({
      toolName: "t1",
      amount: 0.3,
      currency: "USDC",
      merchant: "m1",
      intentId: "i1",
      txSignature: "tx1",
      timestamp: Date.now(),
    });
    expect(tracker.remainingBudget()).toBeCloseTo(0.7);
  });

  it("remainingBudget is Infinity when no dailyCap set", () => {
    const tracker = new SpendingTracker();
    expect(tracker.remainingBudget()).toBe(Infinity);
  });

  it("getPaymentHistory returns all records", () => {
    const tracker = new SpendingTracker();
    tracker.recordPayment({
      toolName: "t1",
      amount: 0.1,
      currency: "USDC",
      merchant: "m1",
      intentId: "i1",
      txSignature: "tx1",
      timestamp: Date.now(),
    });
    tracker.recordPayment({
      toolName: "t2",
      amount: 0.2,
      currency: "SOL",
      merchant: "m2",
      intentId: "i2",
      txSignature: "tx2",
      timestamp: Date.now(),
    });
    const history = tracker.getPaymentHistory();
    expect(history).toHaveLength(2);
    expect(history[0].toolName).toBe("t1");
    expect(history[1].toolName).toBe("t2");
  });
});

// ---------------------------------------------------------------------------
// createV402McpClient — integration with mock MCP client
// ---------------------------------------------------------------------------

describe("createV402McpClient", () => {
  function paymentRequiredResponse(
    toolId: string,
    amount: string,
    merchant = "merchant-addr",
  ) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "payment_required",
            tool_id: toolId,
            amount,
            currency: "USDC",
            merchant,
            intent_id: `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          }),
        },
      ],
      isError: true as const,
    };
  }

  function successResponse(data: unknown) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            result: data,
            _v402_receipt: {
              intent_id: "i",
              tx_signature: "tx",
              tool_id: "t",
            },
          }),
        },
      ],
    };
  }

  it("client detects payment_required and attempts payment", async () => {
    const wallet = {
      pay: vi.fn().mockResolvedValue({ txSig: "mock-tx-sig" }),
    };
    const mcpClient = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce(paymentRequiredResponse("web_search", "0.001"))
        .mockResolvedValueOnce(successResponse({ data: "search results" })),
    };

    const client = createV402McpClient({
      wallet,
      policy: { dailyCap: 1.0 },
    });
    const result = await client.callTool(mcpClient, "web_search", {
      query: "test",
    });

    expect(result.paid).toBe(true);
    expect(wallet.pay).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "merchant-addr", amount: "0.001" }),
    );
    expect(mcpClient.callTool).toHaveBeenCalledTimes(2);
    expect(result.receipt).toBeDefined();
  });

  it("client enforces per-call cap (rejects if tool costs too much)", async () => {
    const wallet = { pay: vi.fn() };
    const mcpClient = {
      callTool: vi
        .fn()
        .mockResolvedValue(paymentRequiredResponse("expensive", "100")),
    };

    const client = createV402McpClient({
      wallet,
      policy: { perCallCap: 1.0 },
    });
    await expect(
      client.callTool(mcpClient, "expensive", {}),
    ).rejects.toThrow("per-call cap");
    expect(wallet.pay).not.toHaveBeenCalled();
  });

  it("client enforces daily cap (rejects if over daily limit)", async () => {
    const wallet = {
      pay: vi.fn().mockResolvedValue({ txSig: "tx-1" }),
    };
    const mcpClient = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce(paymentRequiredResponse("t1", "0.6"))
        .mockResolvedValueOnce(successResponse("ok"))
        .mockResolvedValueOnce(paymentRequiredResponse("t1", "0.6")),
    };

    const client = createV402McpClient({
      wallet,
      policy: { dailyCap: 1.0 },
    });

    await client.callTool(mcpClient, "t1", {});
    await expect(client.callTool(mcpClient, "t1", {})).rejects.toThrow(
      "daily cap",
    );
  });

  it("client enforces allowed tools (rejects unlisted tools)", async () => {
    const wallet = { pay: vi.fn() };
    const mcpClient = {
      callTool: vi
        .fn()
        .mockResolvedValue(
          paymentRequiredResponse("blocked_tool", "0.001"),
        ),
    };

    const client = createV402McpClient({
      wallet,
      policy: { allowedTools: ["web_search", "code_run"] },
    });
    await expect(
      client.callTool(mcpClient, "blocked_tool", {}),
    ).rejects.toThrow("not in allowed list");
    expect(wallet.pay).not.toHaveBeenCalled();
  });

  it("remainingBudget returns correct value after payments", async () => {
    const wallet = {
      pay: vi.fn().mockResolvedValue({ txSig: "tx-1" }),
    };
    const mcpClient = {
      callTool: vi
        .fn()
        .mockResolvedValueOnce(paymentRequiredResponse("t1", "0.3"))
        .mockResolvedValueOnce(successResponse("ok")),
    };

    const client = createV402McpClient({
      wallet,
      policy: { dailyCap: 1.0 },
    });
    expect(client.remainingBudget()).toBe(1.0);

    await client.callTool(mcpClient, "t1", {});
    expect(client.remainingBudget()).toBeCloseTo(0.7);
  });

  it("non-paid tool call returns directly without payment", async () => {
    const wallet = { pay: vi.fn() };
    const mcpClient = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "free result" }],
      }),
    };

    const client = createV402McpClient({ wallet });
    const result = await client.callTool(mcpClient, "free_tool", {});
    expect(result.paid).toBe(false);
    expect(wallet.pay).not.toHaveBeenCalled();
  });
});
