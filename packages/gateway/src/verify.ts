import { verifySolanaPayment } from "@v402pay/core";
import type { PaymentIntent } from "@v402pay/core";
import type { GatewayConfig } from "./config.js";

export async function verifyPayment(
  txSignature: string,
  intent: PaymentIntent,
  config: GatewayConfig
): Promise<{ payer: string }> {
  const result = await verifySolanaPayment(txSignature, intent, {
    rpcUrl: config.solanaRpcUrl,
    usdcMint: config.usdcMint,
    commitment: config.commitment ?? "confirmed",
  });
  return { payer: result.payer };
}
