import { z } from "zod";
import type { SolanaAgentKitLike, V402PluginConfig } from "../types/index.js";
import type { V402Agent } from "@v402pay/agent";
import { getOrInitV402Agent } from "../init.js";

export const payForToolSchema = z.object({
  toolId: z.string().describe("Identifier of the tool or service being paid for"),
  amount: z.string().describe("Payment amount as a decimal string (e.g. '0.01')"),
  currency: z.enum(["SOL", "USDC"]).describe("Payment currency"),
  merchant: z.string().describe("Merchant Solana wallet address (base58)"),
  memo: z.string().optional().describe("Optional memo for the transaction"),
});

export function createPayForToolAction(config: V402PluginConfig) {
  return {
    name: "V402_PAY_FOR_TOOL" as const,
    description:
      "Pay for an external AI tool or API using the v402 payment protocol on Solana. " +
      "Checks the agent's spending policy (daily cap, per-call limit, allowed tools/merchants), " +
      "records the payment, and returns a result. Use when a service requires payment.",
    schema: payForToolSchema,
    handler: async (agent: SolanaAgentKitLike, input: z.infer<typeof payForToolSchema>) => {
      const v402: V402Agent = getOrInitV402Agent(agent, config);
      const amount = parseFloat(input.amount);

      if (!v402.canPay(amount, input.toolId, input.merchant)) {
        const stats = v402.getStats();
        return {
          success: false,
          error:
            `Payment blocked by spending policy. ` +
            `Daily spent: ${stats.dailySpent}/${stats.dailyCap}. ` +
            `Remaining: ${v402.remainingBudget()}`,
        };
      }

      const intentId = `v402_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      v402.recordPayment({
        toolName: input.toolId,
        amount,
        currency: input.currency,
        merchant: input.merchant,
        intentId,
        txSignature: "pending",
        timestamp: Date.now(),
      });

      return {
        success: true,
        intentId,
        amount: input.amount,
        currency: input.currency,
        merchant: input.merchant,
        toolId: input.toolId,
      };
    },
  };
}
