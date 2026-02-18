#!/usr/bin/env node
// CLI tool to pay for any v402-protected endpoint.
// Usage: V402_AGENT_KEY=<base58|json> SOLANA_RPC_URL=<url> node pay.mjs <url> [body]

import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Parse secret key — supports base58 string or JSON byte array
// ---------------------------------------------------------------------------
function loadKeypair(raw) {
  if (!raw) {
    console.error(
      "Error: V402_AGENT_KEY is required.\n" +
        "Set it to a base58 private key or a JSON byte array ([n,n,...]).\n" +
        "Generate one with: node setup-wallet.mjs"
    );
    process.exit(1);
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith("[")) {
    try {
      const bytes = JSON.parse(trimmed);
      return Keypair.fromSecretKey(Uint8Array.from(bytes));
    } catch (err) {
      console.error("Failed to parse V402_AGENT_KEY as JSON byte array:", err.message);
      process.exit(1);
    }
  }

  // base58
  try {
    // Dynamic import so the script works even if bs58 isn't installed yet
    const bs58 = await import("bs58");
    const decode = bs58.default?.decode ?? bs58.decode;
    return Keypair.fromSecretKey(decode(trimmed));
  } catch (err) {
    console.error("Failed to decode V402_AGENT_KEY as base58:", err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const [url, bodyArg] = process.argv.slice(2);

  if (!url) {
    console.error("Usage: node pay.mjs <url> [json-body]");
    console.error("");
    console.error("Examples:");
    console.error('  node pay.mjs https://api.example.com/pay \'{"query":"hello"}\'');
    console.error("  node pay.mjs http://localhost:4040/pay");
    process.exit(1);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const keypair = await loadKeypair(process.env.V402_AGENT_KEY);

  console.log("Agent wallet:", keypair.publicKey.toBase58());
  console.log("RPC:         ", rpcUrl);
  console.log("Target:      ", url);
  console.log("");

  const adapter = createKeypairAdapter({ keypair, rpcUrl });
  const { fetch: v402Fetch } = createV402Client({ walletAdapter: adapter });

  const fetchOptions = { method: "POST" };
  if (bodyArg) {
    fetchOptions.headers = { "Content-Type": "application/json" };
    fetchOptions.body = typeof bodyArg === "string" ? bodyArg : JSON.stringify(bodyArg);
  }

  console.log("Calling endpoint (402 → pay → retry → 200)…");
  const res = await v402Fetch(url, fetchOptions);

  console.log("");
  console.log("Status:", res.status);

  const receipt = res.headers.get("V402-Receipt") || res.headers.get("v402-receipt");
  if (receipt) {
    console.log("Receipt:", receipt);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } else {
    const text = await res.text();
    console.log("Response:", text);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
