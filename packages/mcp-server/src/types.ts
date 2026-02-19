export interface PaidTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  price: string;
  currency: "USDC" | "SOL";
  merchant: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface V402McpServerConfig {
  tools: PaidTool[];
  testMode?: boolean;
  solanaRpcUrl?: string;
  usdcMint?: string;
  serverInfo?: { name?: string; version?: string };
}

export interface V402PaymentProof {
  intent_id: string;
  tx_signature: string;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface PaymentRequiredInfo {
  error: "payment_required";
  tool_id: string;
  amount: string;
  currency: string;
  merchant: string;
  intent_id: string;
}
