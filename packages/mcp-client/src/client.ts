import type {
  V402McpClientConfig,
  McpClientLike,
  McpToolCallResponse,
  PaymentRecord,
  CallToolResult,
} from "./types.js";
import { SpendingTracker } from "./spending.js";

export interface V402McpClient {
  callTool(
    mcpClient: McpClientLike,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult>;
  canPay(amount: number, toolId?: string, merchant?: string): boolean;
  remainingBudget(): number;
  getPaymentHistory(): PaymentRecord[];
}

export function createV402McpClient(config: V402McpClientConfig): V402McpClient {
  const tracker = new SpendingTracker(config.policy);

  async function callTool(
    mcpClient: McpClientLike,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const firstResult = await mcpClient.callTool({
      name: toolName,
      arguments: args,
    });

    const paymentInfo = extractPaymentRequired(firstResult);
    if (!paymentInfo) {
      return { result: firstResult, paid: false };
    }

    const amount = parseFloat(paymentInfo.amount);

    const policyCheck = tracker.checkPolicy(
      amount,
      toolName,
      paymentInfo.merchant,
    );
    if (!policyCheck.allowed) {
      throw new Error(`Payment denied by policy: ${policyCheck.reason}`);
    }

    const payResult = await config.wallet.pay({
      recipient: paymentInfo.merchant,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency,
      reference: paymentInfo.intent_id,
    });

    const retryResult = await mcpClient.callTool({
      name: toolName,
      arguments: {
        ...args,
        _v402_payment: {
          intent_id: paymentInfo.intent_id,
          tx_signature: payResult.txSig,
        },
      },
    });

    tracker.recordPayment({
      toolName,
      amount,
      currency: paymentInfo.currency,
      merchant: paymentInfo.merchant,
      intentId: paymentInfo.intent_id,
      txSignature: payResult.txSig,
      timestamp: Date.now(),
    });

    let receipt: Record<string, unknown> | undefined;
    const text = retryResult.content?.find((c) => c.type === "text")?.text;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed._v402_receipt) receipt = parsed._v402_receipt;
      } catch { /* non-json response — fine */ }
    }

    return { result: retryResult, paid: true, receipt };
  }

  return {
    callTool,
    canPay: (amount, toolId, merchant) =>
      tracker.checkPolicy(amount, toolId, merchant).allowed,
    remainingBudget: () => tracker.remainingBudget(),
    getPaymentHistory: () => tracker.getPaymentHistory(),
  };
}

function extractPaymentRequired(
  result: McpToolCallResponse,
): {
  error: string;
  tool_id: string;
  amount: string;
  currency: string;
  merchant: string;
  intent_id: string;
} | null {
  if (!result.isError) return null;
  const textContent = result.content?.find((c) => c.type === "text");
  if (!textContent?.text) return null;
  try {
    const parsed = JSON.parse(textContent.text);
    if (parsed.error === "payment_required" && parsed.intent_id) return parsed;
    return null;
  } catch {
    return null;
  }
}
