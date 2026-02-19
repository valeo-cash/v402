export interface SpendingPolicy {
  dailyCap?: number;
  perCallCap?: number;
  allowedTools?: string[];
  allowedMerchants?: string[];
}

export interface PaymentRecord {
  toolName: string;
  amount: number;
  currency: string;
  merchant: string;
  intentId: string;
  txSignature: string;
  timestamp: number;
}

export interface WalletAdapter {
  pay(params: {
    recipient: string;
    amount: string;
    currency: string;
    reference: string;
    mint?: string;
  }): Promise<{ txSig: string }>;
  getPublicKey?(): Promise<string> | string;
}

export interface McpClientLike {
  callTool(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<McpToolCallResponse>;
}

export interface McpToolCallResponse {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export interface V402McpClientConfig {
  wallet: WalletAdapter;
  policy?: SpendingPolicy;
}

export interface CallToolResult {
  result: McpToolCallResponse;
  paid: boolean;
  receipt?: Record<string, unknown>;
}
