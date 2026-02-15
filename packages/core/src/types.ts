export const V402_MEMO_PREFIX = "v402:";

export type Currency = "USDC" | "SOL";
export type Chain = "solana";

/** Solana network identifier. */
export type SolanaNetwork = "mainnet-beta" | "devnet" | "testnet";

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
  /** SPL token mint (e.g. USDC). When present, used for USDC transfer verification and adapter. */
  mint?: string;
  /** Solana network (e.g. mainnet-beta, devnet). */
  network?: SolanaNetwork;
};

/** Headers sent by the client on retry after payment. */
export type V402PaymentHeaders = {
  "V402-Intent": string;
  "V402-Tx": string;
  "V402-Request-Hash": string;
};

/** Server response shape when payment was verified (e.g. receipt attached). */
export type V402Response = {
  receipt?: ReceiptPayload;
  receiptSignature?: string;
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
