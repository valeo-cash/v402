/**
 * Browser adapter for Wallet Standard / Phantom. Uses window.phantom?.solana or
 * window.solana. Requires @solana/web3.js and a wallet that implements signAndSendTransaction.
 */

import type { V402WalletAdapter, PayParams, PayResult } from "./adapter.js";

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  }
}

type PhantomProvider = {
  publicKey: { toBase58(): string };
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
    typeof window !== "undefined"
      ? (window as unknown as { __V402_RPC__?: string }).__V402_RPC__
      : undefined;
  const rpcUrl: string = options.rpcUrl ?? rpcFromWindow ?? DEFAULT_RPC;

  const getProvider = (): PhantomProvider | undefined => {
    if (typeof window === "undefined") return undefined;
    return window.phantom?.solana ?? window.solana;
  };

  return {
    getPublicKey: async () => {
      const p = getProvider();
      if (!p?.publicKey) throw new Error("Wallet not connected");
      return p.publicKey.toBase58();
    },
    async pay(params: PayParams): Promise<PayResult> {
      const p = getProvider();
      if (!p) throw new Error("No wallet found (Phantom/Solana Wallet Standard)");

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
        const lamports = Math.ceil(parseFloat(params.amount) * 1e9);
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
        const sig = (result as { signature?: string })?.signature ?? (result as string);
        if (!sig) throw new Error("No signature returned");
        return { txSig: typeof sig === "string" ? sig : String(sig) };
      }

      const splToken = await import("@solana/spl-token").catch(() => {
        throw new Error("Install @solana/spl-token for USDC payments");
      });
      const mint = new web3.PublicKey(
        params.mint ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      );
      const dest = await splToken.getAssociatedTokenAddress(
        mint,
        new web3.PublicKey(params.recipient)
      );
      const source = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
      const amount = Math.ceil(parseFloat(params.amount) * 1e6);
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
      const sig = (result as { signature?: string })?.signature ?? (result as string);
      if (!sig) throw new Error("No signature returned");
      return { txSig: typeof sig === "string" ? sig : String(sig) };
    },
  };
}
