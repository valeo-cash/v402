import { z } from "zod";
import type { SolanaAgentKitLike, V402PluginConfig } from "../types/index.js";
import type { V402Agent } from "@v402pay/agent";
import { getOrInitV402Agent } from "../init.js";

export const getPaymentHistorySchema = z.object({
  limit: z.number().optional().describe("Max number of recent payments to return (default 10)"),
});

export function createGetPaymentHistoryAction(config: V402PluginConfig) {
  return {
    name: "V402_GET_PAYMENT_HISTORY" as const,
    description:
      "Retrieve the agent's v402 payment history. Shows all payments made in the current session " +
      "including tool, amount, currency, merchant, and timestamp. Use when the user asks about " +
      "past payments or for auditing.",
    schema: getPaymentHistorySchema,
    handler: async (agent: SolanaAgentKitLike, input: z.infer<typeof getPaymentHistorySchema>) => {
      const v402: V402Agent = getOrInitV402Agent(agent, config);
      const history = v402.getPaymentHistory();
      const limit = input.limit ?? 10;

      return {
        totalPayments: history.length,
        payments: history.slice(-limit).map((p) => ({
          toolName: p.toolName,
          amount: p.amount,
          currency: p.currency,
          merchant: p.merchant,
          txSignature: p.txSignature,
          timestamp: new Date(p.timestamp).toISOString(),
        })),
      };
    },
  };
}
