import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentIntent } from "@v402pay/core";

const INTENT_EXPIRY_SECONDS = 900;

export type DbPaymentIntent = {
  id: string;
  intent_id: string;
  tool_id: string;
  amount: string;
  currency: string;
  chain: string;
  recipient: string;
  reference: string;
  expires_at: string;
  request_hash: string;
  payer: string | null;
  status: string;
  tool_params_hash?: string | null;
  session_id?: string | null;
  max_calls?: number | null;
  calls_used?: number | null;
  spending_account?: string | null;
};

export function dbIntentToPaymentIntent(row: DbPaymentIntent, requestHash: string): PaymentIntent {
  return {
    intentId: row.intent_id,
    toolId: row.tool_id,
    amount: row.amount,
    currency: row.currency as "USDC" | "SOL",
    chain: row.chain as "solana",
    recipient: row.recipient,
    reference: row.reference,
    expiresAt: row.expires_at,
    requestHash,
    payer: row.payer ?? undefined,
  };
}

export async function findConsumedReceipt(
  supabase: SupabaseClient,
  intentId: string,
  requestHash: string
): Promise<{
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string | null;
  receipt_id: string;
  server_sig: string;
  receipt_payload: Record<string, string>;
} | null> {
  const { data: intent } = await supabase
    .from("payment_intents")
    .select("id")
    .eq("intent_id", intentId)
    .eq("status", "consumed")
    .single();
  if (!intent) return null;

  const { data: receipt } = await supabase
    .from("receipts")
    .select(
      "response_status, response_headers, response_body, receipt_id, server_sig, request_hash, response_hash, tx_sig, payer, merchant, timestamp"
    )
    .eq("intent_id", intent.id)
    .eq("request_hash", requestHash)
    .single();
  if (!receipt) return null;

  return {
    response_status: receipt.response_status,
    response_headers: (receipt.response_headers as Record<string, string>) ?? {},
    response_body: receipt.response_body,
    receipt_id: receipt.receipt_id,
    server_sig: receipt.server_sig,
    receipt_payload: {
      receiptId: receipt.receipt_id,
      requestHash: receipt.request_hash,
      responseHash: receipt.response_hash,
      txSig: receipt.tx_sig,
      payer: receipt.payer,
      merchant: receipt.merchant,
      timestamp: receipt.timestamp,
    },
  };
}

export async function findIntentByReference(
  supabase: SupabaseClient,
  intentId: string
): Promise<DbPaymentIntent | null> {
  const { data } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("intent_id", intentId)
    .single();
  return data as DbPaymentIntent | null;
}

export async function createIntent(
  supabase: SupabaseClient,
  params: {
    toolId: string;
    toolDbId: string;
    amount: string;
    currency: string;
    recipient: string;
    requestHash: string;
    toolParamsHash?: string;
    sessionId?: string;
    maxCalls?: number;
    spendingAccount?: string;
  }
): Promise<DbPaymentIntent> {
  const intentId = crypto.randomUUID();
  const reference = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INTENT_EXPIRY_SECONDS * 1000).toISOString();

  const row: Record<string, unknown> = {
    intent_id: intentId,
    tool_id: params.toolDbId,
    amount: params.amount,
    currency: params.currency,
    chain: "solana",
    recipient: params.recipient,
    reference,
    expires_at: expiresAt,
    request_hash: params.requestHash,
    status: "created",
  };
  if (params.toolParamsHash) row.tool_params_hash = params.toolParamsHash;
  if (params.sessionId) row.session_id = params.sessionId;
  if (params.maxCalls != null) {
    row.max_calls = params.maxCalls;
    row.calls_used = 0;
  }
  if (params.spendingAccount) row.spending_account = params.spendingAccount;

  const { data, error } = await supabase
    .from("payment_intents")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create intent: ${error.message}`);
  return data as DbPaymentIntent;
}

export async function findActiveSessionIntent(
  supabase: SupabaseClient,
  sessionId: string
): Promise<DbPaymentIntent | null> {
  const { data } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "paid_verified")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as DbPaymentIntent | null;
}

export async function incrementCallsUsed(
  supabase: SupabaseClient,
  intentId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("payment_intents")
    .select("calls_used")
    .eq("intent_id", intentId)
    .single();
  const current = (row as { calls_used?: number } | null)?.calls_used ?? 0;
  const { error } = await supabase
    .from("payment_intents")
    .update({ calls_used: current + 1, updated_at: new Date().toISOString() })
    .eq("intent_id", intentId);
  if (error) throw new Error(`Failed to increment calls_used: ${error.message}`);
}

export async function markIntentPaidVerified(
  supabase: SupabaseClient,
  intentId: string,
  payer: string
): Promise<void> {
  const { error } = await supabase
    .from("payment_intents")
    .update({ payer, status: "paid_verified", updated_at: new Date().toISOString() })
    .eq("intent_id", intentId);
  if (error) throw new Error(`Failed to update intent: ${error.message}`);
}

export async function markIntentConsumed(
  supabase: SupabaseClient,
  intentId: string
): Promise<void> {
  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "consumed", updated_at: new Date().toISOString() })
    .eq("intent_id", intentId);
  if (error) throw new Error(`Failed to mark consumed: ${error.message}`);
}
