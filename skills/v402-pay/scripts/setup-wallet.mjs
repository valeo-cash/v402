#!/usr/bin/env node
// Generate a new Solana keypair for use as a v402 agent wallet.
// Writes the secret key (JSON byte array) to .v402-agent-wallet.json in cwd.

import { Keypair } from "@solana/web3.js";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const WALLET_FILE = resolve(process.cwd(), ".v402-agent-wallet.json");

if (existsSync(WALLET_FILE)) {
  console.error(`Wallet file already exists: ${WALLET_FILE}`);
  console.error("Delete it first if you want to generate a new one.");
  process.exit(1);
}

const keypair = Keypair.generate();
const secretBytes = Array.from(keypair.secretKey);

writeFileSync(WALLET_FILE, JSON.stringify(secretBytes), "utf-8");

console.log("Agent wallet created.");
console.log("");
console.log("  Public key:", keypair.publicKey.toBase58());
console.log("  Saved to:  ", WALLET_FILE);
console.log("");
console.log("Fund this address with UAID or USDC on Solana mainnet");
console.log("(or SOL on devnet for testing).");
console.log("");
console.log("To use with pay.mjs:");
console.log("");
console.log(`  V402_AGENT_KEY=$(cat ${WALLET_FILE}) \\`);
console.log("  SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \\");
console.log("    node skills/v402-pay/scripts/pay.mjs https://api.example.com/pay");
console.log("");
console.log("IMPORTANT: Keep .v402-agent-wallet.json secret. Add it to .gitignore.");
