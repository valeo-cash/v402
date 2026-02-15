import type { SupabaseClient } from "@supabase/supabase-js";
import { signReceipt, responseHash, type ReceiptPayload } from "@v402pay/core";
import { decryptMerchantKey } from "./encrypt.js";

export async function createAndStoreReceipt(
  supabase: SupabaseClient,
  params: {
    intentId: string;
    intentDbId: string;
    toolId: string;
    toolDbId: string;
    requestHash: string;
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBody: string;
    txSig: string;
    payer: string;
    merchantWallet: string;
    signingPublicKey: string;
    signingPrivateKeyEncrypted: string;
    encryptionKey: string;
  }
): Promise<{ receiptId: string; serverSig: string; payload: ReceiptPayload }> {
  const responseHashValue = responseHash(
    params.responseStatus,
    params.responseHeaders,
    params.responseBody
  );
  const receiptId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const payload: ReceiptPayload = {
    receiptId,
    intentId: params.intentId,
    toolId: params.toolId,
    requestHash: params.requestHash,
    responseHash: responseHashValue,
    txSig: params.txSig,
    payer: params.payer,
    merchant: params.merchantWallet,
    timestamp,
  };

  const privateKey = decryptMerchantKey(params.signingPrivateKeyEncrypted, params.encryptionKey);
  const serverSig = await signReceipt(payload, privateKey);

  const { error } = await supabase.from("receipts").insert({
    receipt_id: receiptId,
    intent_id: params.intentDbId,
    tool_id: params.toolDbId,
    request_hash: params.requestHash,
    response_hash: responseHashValue,
    tx_sig: params.txSig || "",
    payer: params.payer,
    merchant: params.merchantWallet,
    timestamp,
    server_sig: serverSig,
    response_status: params.responseStatus,
    response_headers: params.responseHeaders,
    response_body: params.responseBody,
  });

  if (error) throw new Error(`Failed to store receipt: ${error.message}`);

  return { receiptId, serverSig, payload };
}
