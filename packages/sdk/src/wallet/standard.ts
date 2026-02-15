/**
 * Browser adapter for Wallet Standard / Phantom.
 * Uses window.phantom?.solana or window.solana; RPC URL from window.__V402_RPC__ or options.
 * Calls connect() if the wallet is not connected; requires @solana/web3.js and signAndSendTransaction.
 */

import { parseAmount } from "@v402pay/core";
import type { V402WalletAdapter, PayParams, PayResult } from "./adapter.js";

const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
    __V402_RPC__?: string;
  }
}

type PhantomProvider = {
  publicKey: { toBase58(): string } | null;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
};

export type WalletStandardAdapterOptions = {
  rpcUrl?: string;
};

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export function createWalletStandardAdapter(
  options: WalletStandardAdapterOptions = {}
): V402WalletAdapter {
  const rpcFromWindow: string | undefined =
    typeof window !== "undefined" ? window.__V402_RPC__ : undefined;
  const rpcUrl: string = options.rpcUrl ?? rpcFromWindow ?? DEFAULT_RPC;

  const getProvider = (): PhantomProvider | undefined => {
    if (typeof window === "undefined") return undefined;
    return window.phantom?.solana ?? window.solana;
  };

  /** Normalize signAndSendTransaction result (object with signature or raw string). */
  function normalizeSignature(result: unknown): string {
    if (typeof result === "string") return result;
    const sig = (result as { signature?: string })?.signature;
    if (typeof sig === "string") return sig;
    throw new Error("Wallet did not return a transaction signature");
  }

  return {
    getPublicKey: async () => {
      const p = getProvider();
      if (!p) throw new Error("No wallet found (Phantom/Solana Wallet Standard)");
      if (p.publicKey == null) throw new Error("Wallet not connected: connect your wallet first");
      return p.publicKey.toBase58();
    },
    async pay(params: PayParams): Promise<PayResult> {
      const p = getProvider();
      if (!p) throw new Error("No wallet found (Phantom/Solana Wallet Standard)");

      if (p.publicKey == null) {
        try {
          await p.request({ method: "connect" });
        } catch (err) {
          throw new Error(
            `Wallet not connected: connect() failed (${err instanceof Error ? err.message : String(err)})`
          );
        }
        if (p.publicKey == null) {
          throw new Error("Wallet not connected: connect() succeeded but publicKey is still null");
        }
      }

      const web3 = await import("@solana/web3.js").catch(() => {
        throw new Error("Install @solana/web3.js for Wallet Standard adapter");
      });
      const connection = new web3.Connection(rpcUrl);
      const fromB58Raw = p.publicKey.toBase58();
      const fromB58Str = typeof fromB58Raw === "string" ? fromB58Raw : undefined;
      const fromPubkey = new web3.PublicKey(fromB58Str ?? String(p.publicKey));
      const ref = typeof params.reference === "string" ? params.reference : undefined;
      const memoPayload = ref != null ? `v402:${ref}` : undefined;
      if (memoPayload == null) throw new Error("Payment requires a reference");
      const memoData = new TextEncoder().encode(memoPayload);
      const memoIx = new web3.TransactionInstruction({
        keys: [],
        programId: new web3.PublicKey(MEMO_PROGRAM_ID),
        data: memoData as unknown as Buffer,
      });

      if (params.currency === "SOL") {
        const lamports = Number(parseAmount(params.amount, SOL_DECIMALS));
        const tx = new web3.Transaction().add(
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey: new web3.PublicKey(params.recipient),
            lamports,
          }),
          memoIx
        );
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;
        const result = await p.request({
          method: "signAndSendTransaction",
          params: { message: tx.serialize({ requireAllSignatures: false }) },
        });
        return { txSig: normalizeSignature(result) };
      }

      const splToken = await import("@solana/spl-token").catch(() => {
        throw new Error("Install @solana/spl-token for USDC payments");
      });
      // Use params.mint when provided (e.g. from intent); mainnet USDC mint is fallback only.
      const mint = new web3.PublicKey(
        params.mint ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      );
      const dest = await splToken.getAssociatedTokenAddress(
        mint,
        new web3.PublicKey(params.recipient)
      );
      const source = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
      const amount = Number(parseAmount(params.amount, USDC_DECIMALS));
      const tx = new web3.Transaction().add(
        splToken.createTransferInstruction(source, dest, fromPubkey, amount),
        memoIx
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = fromPubkey;
      const result = await p.request({
        method: "signAndSendTransaction",
        params: { message: tx.serialize({ requireAllSignatures: false }) },
      });
      return { txSig: normalizeSignature(result) };
    },
  };
}
