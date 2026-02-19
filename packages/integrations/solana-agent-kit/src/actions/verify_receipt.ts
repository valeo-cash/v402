import { z } from "zod";
import type { SolanaAgentKitLike } from "../types/index.js";
import {
  verifyReceiptSignature,
  verifyEd25519Message,
} from "@v402pay/core";
import type { ReceiptPayload } from "@v402pay/core";

export const verifyReceiptSchema = z.object({
  receipt: z.string().describe("V402 receipt as JSON string or base64-encoded JSON"),
});

function tryParseReceipt(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

export const verifyReceiptAction = {
  name: "V402_VERIFY_RECEIPT" as const,
  description:
    "Verify a v402 payment receipt. Checks that the Ed25519 signature is valid " +
    "and the receipt data is authentic. Returns verification status and receipt details.",
  schema: verifyReceiptSchema,
  handler: async (_agent: SolanaAgentKitLike, input: z.infer<typeof verifyReceiptSchema>) => {
    try {
      const receipt = tryParseReceipt(input.receipt);
      const sig = receipt.signature as string | undefined;
      const pubkey =
        (receipt.signer_pubkey as string) ??
        (receipt.signerPubkey as string);

      if (!sig || !pubkey) {
        return { valid: false, error: "Receipt missing signature or signer public key" };
      }

      let valid = false;

      if (receipt.version === 2 && receipt.receipt_hash) {
        valid = await verifyEd25519Message(
          receipt.receipt_hash as string,
          sig,
          pubkey,
        );
      } else {
        const payload = receipt as unknown as ReceiptPayload;
        valid = await verifyReceiptSignature(payload, sig, pubkey);
      }

      return {
        valid,
        intentId: receipt.intent_id ?? receipt.intentId,
        amount: receipt.amount,
        currency: receipt.currency,
        payer: receipt.payer,
        merchant: receipt.merchant,
        toolId: receipt.tool_id ?? receipt.toolId,
        txSignature: receipt.tx_signature ?? receipt.txSig,
        timestamp: receipt.timestamp
          ? new Date(receipt.timestamp as number).toISOString()
          : undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Receipt verification failed";
      return { valid: false, error: msg };
    }
  },
};
