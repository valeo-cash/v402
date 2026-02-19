import type { PaymentIntent } from "../types.js";
import type { VerifiedPayment } from "../types.js";
import { parseAmount } from "../amount.js";
import { MEMO_PROGRAM_ID, hasV402Memo } from "./memo.js";

/** SOL uses 9 decimals (lamports). */
export const SOL_DECIMALS = 9;

/** USDC uses 6 decimals on mainnet and devnet. */
export const USDC_DECIMALS = 6;

const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

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

/**
 * Fetch SPL token account owner via RPC (jsonParsed). Used to verify USDC transfer
 * destination belongs to intent.recipient.
 */
async function getTokenAccountOwner(rpcUrl: string, accountAddress: string): Promise<string | null> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "v402-token-owner",
      method: "getAccountInfo",
      params: [accountAddress, { encoding: "jsonParsed" }],
    }),
  });
  const json = (await res.json()) as {
    result?: { value?: { data?: { parsed?: { info?: { owner?: string } } } } };
    error?: { message: string };
  };
  if (json.error) return null;
  return json.result?.value?.data?.parsed?.info?.owner ?? null;
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
  const topLevel = (message.instructions ?? []) as JsonParsedInstruction[];
  const inner = tx.meta?.innerInstructions ?? [];
  const allInstructions = [
    ...topLevel,
    ...inner.flatMap((g) => g.instructions),
  ] as JsonParsedInstruction[];

  const memos = parseMemoInstructions(tx);
  if (!hasV402Memo(memos, intent.reference)) {
    throw new Error(`Missing Memo instruction with v402:${intent.reference}`);
  }

  const usdcDecimals = config.usdcDecimals ?? USDC_DECIMALS;
  const amountWei =
    intent.currency === "SOL" ? parseAmount(intent.amount, SOL_DECIMALS) : null;
  const amountTokensRaw =
    intent.currency === "USDC" ? parseAmount(intent.amount, usdcDecimals) : null;

  const effectiveUsdcMint = intent.mint ?? config.usdcMint;

  let payer: string | null = null;
  const feePayer = accountKeys[0] != null ? getPubkey(accountKeys[0]) : null;

  if (intent.currency === "SOL") {
    let found = false;
    for (const ix of allInstructions) {
      const program = (ix.programId ?? ix.program) as string | undefined;
      if (program !== SYSTEM_PROGRAM_ID) continue;
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
    // USDC SPL: verify transfer to intent recipient (destination token account owner)
    let found = false;
    for (const ix of allInstructions) {
      const program = (ix.programId ?? ix.program) as string | undefined;
      if (program !== TOKEN_PROGRAM_ID) continue;
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
      const mint = info.mint;
      if (mint != null && mint !== effectiveUsdcMint) continue;
      const dest = info.destination;
      const amt = info.amount;
      const sourceOwner = info.sourceOwner;
      if (!dest || !amt || !sourceOwner) continue;
      const numAmt = BigInt(amt);
      if (amountTokensRaw != null && numAmt < amountTokensRaw) throw new Error("USDC amount too low");

      // Verify destination corresponds to intent.recipient. Option A (preferred): derive expected ATA
      // for (mint, intent.recipient) via @solana/spl-token and compare to info.destination — no extra RPC.
      // If those packages are not available, fall back to getTokenAccountOwner RPC (Option B style).
      try {
        // Optional peer deps: cast through unknown so DTS build doesn't require resolving @solana/* types.
        const web3Mod = (await import(
          /* @ts-ignore - optional peer dependency */
          "@solana/web3.js"
        )) as unknown as { PublicKey: new (s: string) => { toBase58(): string } };
        const splMod = (await import(
          /* @ts-ignore - optional peer dependency */
          "@solana/spl-token"
        )) as unknown as {
          getAssociatedTokenAddressSync(mint: { toBase58(): string }, owner: { toBase58(): string }): { toBase58(): string };
        };
        const mintPk = new web3Mod.PublicKey(effectiveUsdcMint);
        const ownerPk = new web3Mod.PublicKey(intent.recipient);
        const expectedAta = splMod.getAssociatedTokenAddressSync(mintPk, ownerPk);
        if (dest !== expectedAta.toBase58()) {
          throw new Error(
            `USDC transfer destination ${dest} is not the recipient's ATA for intent.recipient (expected ${expectedAta.toBase58()})`
          );
        }
      } catch (ataErr) {
        if (ataErr instanceof Error && !ataErr.message.includes("recipient's ATA")) {
          // Packages not available or other error: fall back to RPC to verify destination owner.
          const destOwner = await getTokenAccountOwner(url, dest);
          if (destOwner !== intent.recipient) {
            throw new Error(
              `USDC transfer destination owner ${destOwner ?? "unknown"} does not match intent recipient ${intent.recipient}`
            );
          }
        } else {
          throw ataErr;
        }
      }

      payer = sourceOwner;
      found = true;
      break;
    }
    if (!found) throw new Error("USDC transfer for intent recipient/mint not found");
  }

  if (!payer) throw new Error("Could not derive payer");
  if (intent.payer && intent.payer !== payer) throw new Error("Payer mismatch");

  return { txSig: txSignature, payer, blockTime };
}
