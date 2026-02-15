#!/usr/bin/env node
/**
 * Call a v402-protected URL. Uses a new Keypair each run (dev/test only).
 *
 * Usage: npx @v402pay/sdk <url>
 * Example: npx @v402pay/sdk http://localhost:4040/pay
 *
 * Env: SOLANA_RPC_URL (default https://api.devnet.solana.com)
 */
import { createV402Client } from "./client.js";
import { createKeypairAdapter } from "./wallet/keypair.js";

async function main() {
  const url = process.argv[2] || "http://localhost:4040/pay";
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

  const { Keypair } = await import("@solana/web3.js");
  const keypair = Keypair.generate();
  const adapter = createKeypairAdapter({ keypair, rpcUrl });
  const { fetch } = createV402Client({ walletAdapter: adapter });

  console.log("Calling", url, "(keypair has no SOL by default; airdrop for 200)");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => res.text());
  console.log("Status:", res.status);
  console.log("Body:", typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
