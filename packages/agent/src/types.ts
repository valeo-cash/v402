import type { WalletAdapter, PaymentRecord } from "@v402pay/mcp-client";

export type { PaymentRecord };

export interface SpendingPolicy {
  dailyCap: number;
  perCallCap?: number;
  allowedTools?: string[];
  allowedMerchants?: string[];
  expiry?: Date;
}

export interface AgentConfig {
  wallet: WalletAdapter;
  spendingPolicy: SpendingPolicy;
  rpcUrl?: string;
  onPayment?: (event: PaymentEvent) => void;
  onPolicyViolation?: (violation: PolicyViolation) => void;
}

export type PaymentEvent = PaymentRecord;

export interface PolicyViolation {
  reason: string;
  amount: number;
  toolId?: string;
  merchant?: string;
}

export interface AgentStats {
  dailySpent: number;
  dailyCap: number;
  totalPayments: number;
  totalSpent: number;
}
