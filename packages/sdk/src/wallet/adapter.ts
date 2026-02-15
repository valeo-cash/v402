import type { PaymentIntent } from "@v402pay/core";

export type PayParams = {
  recipient: string;
  amount: string;
  currency: "USDC" | "SOL";
  reference: string;
  mint?: string;
};

export type PayResult = { txSig: string };

/**
 * Wallet adapter for non-custodial payment. The server never sees the private key.
 * - Browser: use Wallet Standard / Phantom adapter.
 * - Node (dev only): use Keypair adapter; document as unsafe for production.
 */
export interface V402WalletAdapter {
  pay(params: PayParams): Promise<PayResult>;
  /** Optional: public key of the payer (for client-side checks) */
  getPublicKey?(): Promise<string> | string;
}

/**
 * Map a PaymentIntent from a 402 response to PayParams for the wallet adapter.
 * Passes through optional mint when present on the intent.
 */
export function intentToPayParams(intent: PaymentIntent): PayParams {
  return {
    recipient: intent.recipient,
    amount: intent.amount,
    currency: intent.currency,
    reference: intent.reference,
    mint: intent.mint ?? undefined,
  };
}
