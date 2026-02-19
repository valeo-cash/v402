import type {
  PaidTool,
  V402McpServerConfig,
  V402PaymentProof,
  McpToolResult,
} from "./types.js";
import type { IntentStore } from "./intent-store.js";

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _v402?: { price: string; currency: string; merchant: string };
}

export function createToolList(tools: PaidTool[]): McpToolDef[] {
  return tools.map((t) => ({
    name: t.name,
    description: `${t.description}\n\n[v402: ${t.price} ${t.currency}]`,
    inputSchema: {
      type: "object" as const,
      properties: {
        ...((t.inputSchema.properties as Record<string, unknown>) ?? {}),
        _v402_payment: {
          type: "object",
          description:
            "v402 payment proof — omit on initial call to receive a payment intent",
          properties: {
            intent_id: { type: "string" },
            tx_signature: { type: "string" },
          },
        },
      },
      required: [...((t.inputSchema.required as string[]) ?? [])],
    },
    _v402: {
      price: t.price,
      currency: t.currency,
      merchant: t.merchant,
    },
  }));
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  tools: PaidTool[],
  intentStore: IntentStore,
  config: V402McpServerConfig,
): Promise<McpToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: "tool_not_found", name }) },
      ],
      isError: true,
    };
  }

  const payment = args._v402_payment as V402PaymentProof | undefined;

  if (!payment) {
    const intent = intentStore.create(
      tool.name,
      tool.price,
      tool.currency,
      tool.merchant,
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "payment_required",
            tool_id: tool.name,
            amount: tool.price,
            currency: tool.currency,
            merchant: tool.merchant,
            intent_id: intent.intentId,
          }),
        },
      ],
      isError: true,
    };
  }

  const intent = intentStore.get(payment.intent_id);
  if (!intent) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "payment_invalid",
            reason: "Intent not found",
          }),
        },
      ],
      isError: true,
    };
  }

  if (intent.status === "consumed") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "payment_invalid",
            reason: "Intent already consumed",
          }),
        },
      ],
      isError: true,
    };
  }

  if (Date.now() > intent.expiresAt) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "payment_invalid",
            reason: "Intent expired",
          }),
        },
      ],
      isError: true,
    };
  }

  if (!payment.tx_signature) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "payment_invalid",
            reason: "Missing tx_signature",
          }),
        },
      ],
      isError: true,
    };
  }

  if (!config.testMode) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "payment_invalid",
            reason:
              "On-chain verification requires gateway config; use testMode for local development",
          }),
        },
      ],
      isError: true,
    };
  }

  intentStore.markVerified(payment.intent_id, "test-payer");

  try {
    const handlerArgs = { ...args };
    delete handlerArgs._v402_payment;
    const result = await tool.handler(handlerArgs);
    intentStore.markConsumed(payment.intent_id);

    const receipt = {
      receipt_id: `receipt-${intent.intentId}`,
      intent_id: intent.intentId,
      tool_id: tool.name,
      amount: tool.price,
      currency: tool.currency,
      merchant: tool.merchant,
      tx_signature: payment.tx_signature,
      payer: intent.payer ?? "test-payer",
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ result, _v402_receipt: receipt }),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "tool_execution_failed",
            reason: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
      isError: true,
    };
  }
}
