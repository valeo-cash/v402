import type { SolanaAgentKitLike, V402PluginConfig, V402PaymentResult, V402SpendingStatus } from "./types/index.js";
import type { V402Agent } from "@v402pay/agent";
import { getOrInitV402Agent } from "./init.js";
import { createPayForToolAction } from "./actions/pay_for_tool.js";
import { createCheckSpendingBudgetAction } from "./actions/check_spending_budget.js";
import { createGetPaymentHistoryAction } from "./actions/get_payment_history.js";
import { verifyReceiptAction } from "./actions/verify_receipt.js";

export type { V402PluginConfig, V402PaymentResult, V402SpendingStatus };
export type { SolanaAgentKitLike } from "./types/index.js";

/**
 * Creates a v402 payment plugin for Solana Agent Kit v2.
 *
 * ```typescript
 * import { createV402Plugin } from "@v402pay/solana-agent-kit";
 *
 * const agent = new SolanaAgentKit(wallet, rpcUrl, config)
 *   .use(createV402Plugin({
 *     spendingPolicy: {
 *       dailyCap: 10,
 *       perCallCap: 1,
 *       allowedTools: ["web_search"],
 *     }
 *   }));
 * ```
 */
export function createV402Plugin(config: V402PluginConfig) {
  const payForTool = createPayForToolAction(config);
  const checkBudget = createCheckSpendingBudgetAction(config);
  const getHistory = createGetPaymentHistoryAction(config);

  return {
    name: "v402-payments",

    methods: {
      v402PayForTool: async (
        agent: SolanaAgentKitLike,
        toolId: string,
        amount: string,
        currency: "SOL" | "USDC",
        merchant: string,
        memo?: string,
      ): Promise<V402PaymentResult> => {
        return payForTool.handler(agent, { toolId, amount, currency, merchant, memo });
      },

      v402CheckBudget: async (
        agent: SolanaAgentKitLike,
      ): Promise<V402SpendingStatus> => {
        return checkBudget.handler(agent, {});
      },

      v402GetPaymentHistory: async (
        agent: SolanaAgentKitLike,
        limit?: number,
      ) => {
        return getHistory.handler(agent, { limit });
      },

      v402VerifyReceipt: async (
        agent: SolanaAgentKitLike,
        receipt: string,
      ) => {
        return verifyReceiptAction.handler(agent, { receipt });
      },

      v402CanPay: async (
        agent: SolanaAgentKitLike,
        amount: number,
        toolId?: string,
        merchant?: string,
      ): Promise<boolean> => {
        const v402: V402Agent = getOrInitV402Agent(agent, config);
        return v402.canPay(amount, toolId, merchant);
      },

      v402RemainingBudget: async (
        agent: SolanaAgentKitLike,
      ): Promise<number> => {
        const v402: V402Agent = getOrInitV402Agent(agent, config);
        return v402.remainingBudget();
      },
    },

    actions: [
      payForTool,
      checkBudget,
      getHistory,
      verifyReceiptAction,
    ],
  };
}

export default createV402Plugin({
  spendingPolicy: { dailyCap: 1 },
});
