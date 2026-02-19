import { createV402McpClient, SpendingTracker } from "@v402pay/mcp-client";
import type { V402McpClient } from "@v402pay/mcp-client";
import type {
  AgentConfig,
  PaymentEvent,
  AgentStats,
  SpendingPolicy,
} from "./types.js";
import type { WalletAdapter } from "@v402pay/mcp-client";

export interface V402Agent {
  canPay(amount: number, toolId?: string, merchant?: string): boolean;
  remainingBudget(): number;
  getPaymentHistory(): PaymentEvent[];
  getStats(): AgentStats;
  recordPayment(event: PaymentEvent): void;
  mcpClient: V402McpClient;
  policy: SpendingPolicy;
  wallet: WalletAdapter;
}

export function createAgent(config: AgentConfig): V402Agent {
  const tracker = new SpendingTracker({
    dailyCap: config.spendingPolicy.dailyCap,
    perCallCap: config.spendingPolicy.perCallCap,
    allowedTools: config.spendingPolicy.allowedTools,
    allowedMerchants: config.spendingPolicy.allowedMerchants,
  });

  const mcpClient = createV402McpClient({
    wallet: config.wallet,
    policy: {
      dailyCap: config.spendingPolicy.dailyCap,
      perCallCap: config.spendingPolicy.perCallCap,
      allowedTools: config.spendingPolicy.allowedTools,
      allowedMerchants: config.spendingPolicy.allowedMerchants,
    },
  });

  function canPay(
    amount: number,
    toolId?: string,
    merchant?: string,
  ): boolean {
    if (
      config.spendingPolicy.expiry &&
      config.spendingPolicy.expiry.getTime() < Date.now()
    ) {
      config.onPolicyViolation?.({
        reason: "Policy expired",
        amount,
        toolId,
        merchant,
      });
      return false;
    }

    const check = tracker.checkPolicy(amount, toolId, merchant);
    if (!check.allowed) {
      config.onPolicyViolation?.({
        reason: check.reason!,
        amount,
        toolId,
        merchant,
      });
      return false;
    }
    return true;
  }

  function recordPayment(event: PaymentEvent): void {
    tracker.recordPayment(event);
    config.onPayment?.(event);
  }

  function remainingBudget(): number {
    return tracker.remainingBudget();
  }

  function getPaymentHistory(): PaymentEvent[] {
    return tracker.getPaymentHistory();
  }

  function getStats(): AgentStats {
    const history = tracker.getPaymentHistory();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    const dailySpent = history
      .filter((p) => p.timestamp >= todayMs)
      .reduce((s, p) => s + p.amount, 0);
    const totalSpent = history.reduce((s, p) => s + p.amount, 0);
    return {
      dailySpent,
      dailyCap: config.spendingPolicy.dailyCap,
      totalPayments: history.length,
      totalSpent,
    };
  }

  return {
    canPay,
    recordPayment,
    remainingBudget,
    getPaymentHistory,
    getStats,
    mcpClient,
    policy: config.spendingPolicy,
    wallet: config.wallet,
  };
}
