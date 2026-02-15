/**
 * Node-only adapter using a Keypair. For local development and testing ONLY.
 * UNSAFE for production: never use in browser or with real funds.
 */

import type { Keypair } from "@solana/web3.js";
import type { V402WalletAdapter, PayParams, PayResult } from "./adapter.js";

export type KeypairAdapterOptions = {
  /** Keypair (e.g. from @solana/web3.js Keypair.generate() or fromSecretKey) */
  keypair: { publicKey: { toBase58(): string }; secretKey: Uint8Array };
  rpcUrl: string;
};

export function createKeypairAdapter(options: KeypairAdapterOptions): V402WalletAdapter {
  const { keypair, rpcUrl } = options;

  return {
    getPublicKey: () => keypair.publicKey.toBase58(),

    async pay(params: PayParams): Promise<PayResult> {
      const mod = await import("@solana/web3.js");
      const connection = new mod.Connection(rpcUrl);
      const signer = keypair as unknown as Keypair;
      const memoData = new TextEncoder().encode(`v402:${params.reference}`);

      if (params.currency === "SOL") {
        const lamports = Math.ceil(parseFloat(params.amount) * 1e9);
        const tx = new mod.Transaction().add(
          mod.SystemProgram.transfer({
            fromPubkey: signer.publicKey,
            toPubkey: new mod.PublicKey(params.recipient),
            lamports,
          }),
          new mod.TransactionInstruction({
            keys: [],
            programId: new mod.PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: memoData as unknown as Buffer,
          })
        );
        const sig = await mod.sendAndConfirmTransaction(connection, tx, [signer]);
        return { txSig: sig };
      }

      const splToken = await import("@solana/spl-token").catch(() => {
        throw new Error("Install @solana/spl-token for USDC payments");
      });
      const mint = new mod.PublicKey(params.mint ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      const dest = await splToken.getAssociatedTokenAddress(
        mint,
        new mod.PublicKey(params.recipient)
      );
      const source = await splToken.getAssociatedTokenAddress(
        mint,
        signer.publicKey
      );
      const amount = Math.ceil(parseFloat(params.amount) * 1e6);
      const tx = new mod.Transaction()
        .add(
          splToken.createTransferInstruction(
            source,
            dest,
            signer.publicKey,
            amount
          ),
          new mod.TransactionInstruction({
            keys: [],
            programId: new mod.PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: memoData as unknown as Buffer,
          })
        );
      const sig = await mod.sendAndConfirmTransaction(connection, tx, [signer]);
      return { txSig: sig };
    },
  };
}
