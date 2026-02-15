export const V402_MEMO_PREFIX = "v402:";

export type Currency = "USDC" | "SOL";
export type Chain = "solana";

export type PaymentIntent = {
  intentId: string;
  toolId: string;
  amount: string;
  currency: Currency;
  chain: Chain;
  recipient: string;
  reference: string;
  expiresAt: string;
  requestHash: string;
  payer?: string;
};

export type ReceiptPayload = {
  receiptId: string;
  intentId: string;
  toolId: string;
  requestHash: string;
  responseHash: string;
  txSig: string;
  payer: string;
  merchant: string;
  timestamp: string;
};

export type ToolMetadataPayload = {
  toolId: string;
  name: string;
  description: string;
  baseUrl: string;
  pathPattern: string;
  pricingModel: Record<string, unknown>;
  acceptedCurrency: Currency;
  merchantWallet: string;
  createdAt: string;
  updatedAt: string;
};

export type Policy = {
  maxSpendPerDay?: string;
  maxSpendPerCall?: string;
  allowlistedToolIds?: string[];
  allowlistedMerchants?: string[];
};

export type VerifiedPayment = {
  txSig: string;
  payer: string;
  blockTime: number;
};
