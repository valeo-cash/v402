import type { PaymentIntent } from "../types.js";
import type { VerifiedPayment } from "../types.js";
import { MEMO_PROGRAM_ID, hasV402Memo } from "./memo.js";

/** USDC uses 6 decimals on mainnet and devnet. */
export const USDC_DECIMALS = 6;

export type SolanaVerifyConfig = {
  rpcUrl: string;
  usdcMint: string;
  commitment?: "processed" | "confirmed" | "finalized";
  /** Override for USDC decimals (default 6). Used when comparing intent amount to chain amount. */
  usdcDecimals?: number;
};

type JsonParsedInstruction = {
  programId?: string;
  program?: string;
  parsed?: unknown;
  type?: string;
  [key: string]: unknown;
};

type JsonParsedTx = {
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string } | string>;
      instructions?: JsonParsedInstruction[];
    };
    signatures?: string[];
  };
  blockTime: number | null;
  meta?: {
    err: unknown;
    innerInstructions?: Array<{ index: number; instructions: JsonParsedInstruction[] }>;
  };
};

function getPubkey(acc: { pubkey: string } | string): string {
  return typeof acc === "string" ? acc : acc.pubkey;
}

function collectMemoData(instructions: JsonParsedInstruction[]): { data: string }[] {
  const memos: { data: string }[] = [];
  for (const ix of instructions) {
    const programId = (ix.programId ?? ix.program) as string | undefined;
    if (programId !== MEMO_PROGRAM_ID) continue;
    const data = (ix as { data?: string }).data ?? (ix.parsed as { memo?: string } | undefined)?.memo;
    if (typeof data === "string") memos.push({ data });
  }
  return memos;
}

function parseMemoInstructions(tx: JsonParsedTx): { data: string }[] {
  const instructions = tx.transaction?.message?.instructions ?? [];
  let memos = collectMemoData(instructions);
  const inner = tx.meta?.innerInstructions ?? [];
  for (const group of inner) {
    memos = memos.concat(collectMemoData(group.instructions));
  }
  return memos;
}

/**
 * Fetch transaction and verify it matches the payment intent.
 * Payer: SOL = fee payer (first signer); USDC = owner of source token account.
 */
export async function verifySolanaPayment(
  txSignature: string,
  intent: PaymentIntent,
  config: SolanaVerifyConfig
): Promise<VerifiedPayment> {
  const url = config.rpcUrl.replace(/\/$/, "");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "v402-verify",
      method: "getTransaction",
      params: [
        txSignature,
        {
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
          commitment: config.commitment ?? "confirmed",
        },
      ],
    }),
  });
  const json = (await res.json()) as { result: JsonParsedTx | null; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  const tx = json.result;
  if (!tx?.transaction?.message) throw new Error("Transaction not found or not confirmed");

  const blockTime = tx.blockTime;
  if (blockTime == null) throw new Error("Transaction has no blockTime");
  const expiresAtMs = new Date(intent.expiresAt).getTime();
  if (blockTime * 1000 > expiresAtMs) throw new Error("Transaction is after intent expiry");

  if (tx.meta?.err) throw new Error("Transaction failed");

  const message = tx.transaction.message;
  const accountKeys = message.accountKeys ?? [];
  const instructions = (message.instructions ?? []) as JsonParsedInstruction[];

  const memos = parseMemoInstructions(tx);
  if (!hasV402Memo(memos, intent.reference)) {
    throw new Error(`Missing Memo instruction with v402:${intent.reference}`);
  }

  const amountWei = intent.currency === "SOL" ? BigInt(Math.ceil(parseFloat(intent.amount) * 1e9)) : null;
  const usdcDecimals = config.usdcDecimals ?? USDC_DECIMALS;
  const amountTokensRaw = intent.currency === "USDC" ? Math.ceil(parseFloat(intent.amount) * 10 ** usdcDecimals) : null;

  let payer: string | null = null;
  const feePayer = accountKeys[0] != null ? getPubkey(accountKeys[0]) : null;

  if (intent.currency === "SOL") {
    let found = false;
    for (const ix of instructions) {
      const program = (ix.programId ?? ix.program) as string | undefined;
      if (program !== "11111111111111111111111111111111") continue;
      const parsed = ix.parsed as { type?: string; info?: { destination?: string; lamports?: number } } | undefined;
      if (parsed?.type === "transfer" && parsed.info?.destination === intent.recipient) {
        const lamports = parsed.info.lamports ?? 0;
        if (amountWei !== null && BigInt(lamports) < amountWei) throw new Error("SOL amount too low");
        found = true;
        break;
      }
    }
    if (!found) throw new Error("SOL transfer to recipient not found");
    payer = feePayer;
  } else {
    // USDC SPL
    let found = false;
    for (const ix of instructions) {
      const program = (ix.programId ?? ix.program) as string | undefined;
      if (program !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") continue;
      const parsed = ix.parsed as {
        type?: string;
        info?: {
          destination?: string;
          source?: string;
          amount?: string;
          mint?: string;
          sourceOwner?: string;
        };
      } | undefined;
      if (parsed?.type !== "transfer") continue;
      const info = parsed.info;
      if (!info) continue;
      if (info.mint !== config.usdcMint) continue;
      const dest = info.destination;
      const amt = info.amount;
      const sourceOwner = info.sourceOwner;
      if (!dest || !amt || !sourceOwner) continue;
      const numAmt = parseInt(amt, 10);
      if (amountTokensRaw != null && numAmt < amountTokensRaw) throw new Error("USDC amount too low");
      payer = sourceOwner;
      found = true;
      break;
    }
    if (!found) throw new Error("USDC transfer for intent recipient/mint not found");
  }

  if (!payer) throw new Error("Could not derive payer");

  return { txSig: txSignature, payer, blockTime };
}
