import { describe, it, expect } from "vitest";
import {
  createToolList,
  handleToolCall,
  IntentStore,
} from "@v402pay/mcp-server";
import type { PaidTool, V402McpServerConfig } from "@v402pay/mcp-server";

const testTools: PaidTool[] = [
  {
    name: "get_weather",
    description: "Get weather for a location",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
    price: "0.001",
    currency: "USDC",
    merchant: "7nYRmhGKdR4mCfJLfQbAaZ9sGkS3vZoNM3y8EqMkbK8k",
    handler: async (args) => ({
      temperature: 72,
      city: args.city,
      unit: "F",
    }),
  },
  {
    name: "analyze_text",
    description: "Analyze text sentiment",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    price: "0.005",
    currency: "USDC",
    merchant: "7nYRmhGKdR4mCfJLfQbAaZ9sGkS3vZoNM3y8EqMkbK8k",
    handler: async (args) => ({
      wordCount: String(args.text).split(/\s+/).length,
      sentiment: "positive",
    }),
  },
];

const testConfig: V402McpServerConfig = { tools: testTools, testMode: true };

describe("V402 MCP Server", () => {
  // -----------------------------------------------------------------------
  // Tool list
  // -----------------------------------------------------------------------

  it("tool list includes v402 pricing metadata", () => {
    const list = createToolList(testTools);
    expect(list).toHaveLength(2);

    expect(list[0].name).toBe("get_weather");
    expect(list[0].description).toContain("[v402: 0.001 USDC]");
    expect(list[0]._v402).toEqual({
      price: "0.001",
      currency: "USDC",
      merchant: "7nYRmhGKdR4mCfJLfQbAaZ9sGkS3vZoNM3y8EqMkbK8k",
    });
    expect(
      (list[0].inputSchema.properties as Record<string, unknown>)
        ._v402_payment,
    ).toBeDefined();

    expect(list[1].name).toBe("analyze_text");
    expect(list[1].description).toContain("[v402: 0.005 USDC]");
  });

  // -----------------------------------------------------------------------
  // Tool call without payment → payment_required
  // -----------------------------------------------------------------------

  it("tool call without payment returns payment_required with correct intent", async () => {
    const store = new IntentStore();
    const result = await handleToolCall(
      "get_weather",
      { city: "NYC" },
      testTools,
      store,
      testConfig,
    );

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("payment_required");
    expect(parsed.tool_id).toBe("get_weather");
    expect(parsed.amount).toBe("0.001");
    expect(parsed.currency).toBe("USDC");
    expect(parsed.merchant).toBe(
      "7nYRmhGKdR4mCfJLfQbAaZ9sGkS3vZoNM3y8EqMkbK8k",
    );
    expect(parsed.intent_id).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Tool call with valid payment → handler executes + receipt
  // -----------------------------------------------------------------------

  it("tool call with valid mock payment executes handler and returns result + receipt", async () => {
    const store = new IntentStore();

    const first = await handleToolCall(
      "get_weather",
      { city: "Tokyo" },
      testTools,
      store,
      testConfig,
    );
    const intentId = JSON.parse(first.content[0].text).intent_id;

    const result = await handleToolCall(
      "get_weather",
      {
        city: "Tokyo",
        _v402_payment: { intent_id: intentId, tx_signature: "mock-tx-sig" },
      },
      testTools,
      store,
      testConfig,
    );

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.result).toEqual({
      temperature: 72,
      city: "Tokyo",
      unit: "F",
    });
    expect(parsed._v402_receipt).toBeDefined();
    expect(parsed._v402_receipt.intent_id).toBe(intentId);
    expect(parsed._v402_receipt.tx_signature).toBe("mock-tx-sig");
    expect(parsed._v402_receipt.tool_id).toBe("get_weather");
    expect(parsed._v402_receipt.amount).toBe("0.001");
  });

  // -----------------------------------------------------------------------
  // Tool call with invalid payment → error
  // -----------------------------------------------------------------------

  it("tool call with invalid payment returns error", async () => {
    const store = new IntentStore();
    const result = await handleToolCall(
      "get_weather",
      {
        city: "NYC",
        _v402_payment: {
          intent_id: "nonexistent-intent",
          tx_signature: "mock-tx",
        },
      },
      testTools,
      store,
      testConfig,
    );

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("payment_invalid");
    expect(parsed.reason).toContain("Intent not found");
  });

  it("replay of already-consumed intent is rejected", async () => {
    const store = new IntentStore();

    const first = await handleToolCall(
      "get_weather",
      { city: "NYC" },
      testTools,
      store,
      testConfig,
    );
    const intentId = JSON.parse(first.content[0].text).intent_id;

    await handleToolCall(
      "get_weather",
      {
        city: "NYC",
        _v402_payment: { intent_id: intentId, tx_signature: "tx1" },
      },
      testTools,
      store,
      testConfig,
    );

    const replay = await handleToolCall(
      "get_weather",
      {
        city: "NYC",
        _v402_payment: { intent_id: intentId, tx_signature: "tx2" },
      },
      testTools,
      store,
      testConfig,
    );

    expect(replay.isError).toBe(true);
    const parsed = JSON.parse(replay.content[0].text);
    expect(parsed.error).toBe("payment_invalid");
    expect(parsed.reason).toContain("already consumed");
  });
});
