/**
 * Call a v402-protected endpoint using @v402pay/sdk (Keypair adapter, dev only).
 * Run: node call-with-sdk.mjs
 * Requires: SOLANA_RPC_URL; keypair has funds on the configured network.
 */
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();
const adapter = createKeypairAdapter({
  keypair,
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
});
const { fetch } = createV402Client({ walletAdapter: adapter });
const res = await fetch("http://localhost:4040/pay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
console.log(res.status, await res.json());
