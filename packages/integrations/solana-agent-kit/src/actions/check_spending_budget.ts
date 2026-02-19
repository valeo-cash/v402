import { z } from "zod";
import type { SolanaAgentKitLike, V402PluginConfig } from "../types/index.js";
import type { V402Agent } from "@v402pay/agent";
import { getOrInitV402Agent } from "../init.js";

export const checkSpendingBudgetSchema = z.object({});

export function createCheckSpendingBudgetAction(config: V402PluginConfig) {
  return {
    name: "V402_CHECK_SPENDING_BUDGET" as const,
    description:
      "Check the agent's current v402 spending budget and policy status. " +
      "Returns daily cap, amount spent today, remaining budget, and whether " +
      "the policy has expired. Use before making payments or when asked about limits.",
    schema: checkSpendingBudgetSchema,
    handler: async (agent: SolanaAgentKitLike, _input: z.infer<typeof checkSpendingBudgetSchema>) => {
      const v402: V402Agent = getOrInitV402Agent(agent, config);
      const stats = v402.getStats();
      const policy = v402.policy;

      return {
        dailyCap: stats.dailyCap,
        dailySpent: stats.dailySpent,
        remainingBudget: v402.remainingBudget(),
        totalPayments: stats.totalPayments,
        totalSpent: stats.totalSpent,
        allowedTools: (policy.allowedTools ?? "all") as string[] | "all",
        allowedMerchants: (policy.allowedMerchants ?? "all") as string[] | "all",
        policyExpiry: policy.expiry ? policy.expiry.toISOString() : "none",
        policyExpired: policy.expiry ? new Date() > policy.expiry : false,
      };
    },
  };
}
