/**
 * Minimal interface matching SolanaAgentKit so the plugin compiles
 * without the peer dependency installed.
 */
export interface SolanaAgentKitLike {
  wallet: {
    publicKey?: { toString(): string };
    signTransaction?: (...args: unknown[]) => unknown;
  };
  connection?: { rpcEndpoint: string };
  [key: string]: unknown;
}

export interface V402PluginConfig {
  spendingPolicy: {
    dailyCap: number;
    perCallCap?: number;
    allowedTools?: string[];
    allowedMerchants?: string[];
    expiry?: Date;
  };
  v402CloudKey?: string;
  verifyRpcUrl?: string;
}

export interface V402PaymentResult {
  success: boolean;
  txSignature?: string;
  receipt?: string;
  amount?: string;
  currency?: string;
  merchant?: string;
  toolId?: string;
  error?: string;
}

export interface V402SpendingStatus {
  dailyCap: number;
  dailySpent: number;
  remainingBudget: number;
  totalPayments: number;
  totalSpent: number;
  allowedTools: string[] | "all";
  allowedMerchants: string[] | "all";
  policyExpiry: string;
  policyExpired: boolean;
}
