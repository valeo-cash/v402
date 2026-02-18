---
name: v402-pay
description: Pay for v402-protected API endpoints using UAID/USDC on Solana. Non-custodial keypair wallet, real on-chain settlement, signed receipts.
metadata:
  openclaw:
    emoji: 💸
    requires:
      - "@v402pay/sdk"
      - "@solana/web3.js"
      - "@solana/spl-token"
    install: "Read https://raw.githubusercontent.com/valeo-cash/v402/main/skills/v402-pay/SKILL.md and install it."
---

# v402-pay

**v402-pay** is an OpenClaw agent skill that lets AI agents pay for v402-protected APIs using UAID (primary) or USDC (fallback) on Solana. Payments are non-custodial: the agent holds its own keypair, signs transactions locally, and never shares its secret key with any server.

## What this skill does

When an AI agent calls a v402-protected endpoint:

1. The server returns **HTTP 402** with a payment intent (amount, recipient, reference, expiry).
2. The agent pays from its own Solana wallet (UAID preferred, USDC fallback).
3. The agent retries the request with proof headers (`V402-Intent`, `V402-Tx`, `V402-Request-Hash`).
4. The server verifies the on-chain transaction and returns **200** with a signed `V402-Receipt`.

No custodial services, no Privy, no facilitator — just a local keypair and real Solana transactions.

## Quick start

### 1. Set up an agent wallet

```bash
node skills/v402-pay/scripts/setup-wallet.mjs
```

This generates a new Solana keypair and writes it to `.v402-agent-wallet.json`. Fund it with UAID or USDC on mainnet (or SOL on devnet for testing).

### 2. Pay for an endpoint

```bash
V402_AGENT_KEY=$(cat .v402-agent-wallet.json) \
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
  node skills/v402-pay/scripts/pay.mjs https://api.example.com/pay '{"query":"hello"}'
```

The script handles the full 402 → pay → retry → 200 flow automatically.

### 3. Use in code

```javascript
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

// Load agent wallet (supports base58 or JSON byte array)
const raw = process.env.V402_AGENT_KEY;
let keypair;
if (raw.startsWith("[")) {
  keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
} else {
  const bs58 = await import("bs58");
  keypair = Keypair.fromSecretKey(bs58.default.decode(raw));
}

const adapter = createKeypairAdapter({
  keypair,
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
});

const { fetch } = createV402Client({ walletAdapter: adapter });

const res = await fetch("https://api.example.com/pay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "hello" }),
});

console.log(res.status);                          // 200
console.log(res.headers.get("V402-Receipt"));     // signed receipt
console.log(await res.json());                    // upstream response
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `V402_AGENT_KEY` | Yes | Solana secret key — base58 string or JSON byte array `[n,n,...]` |
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint (mainnet or devnet) |
| `UAID_MINT` | No | UAID SPL token mint address (used when paying with UAID) |
| `USDC_MINT` | No | USDC SPL token mint (defaults to `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) |

## Supported secret key formats

The scripts and code examples accept `V402_AGENT_KEY` in two formats:

- **Base58 string** — e.g. `5KQwrPbwd2tz...` (standard Solana CLI export)
- **JSON byte array** — e.g. `[174,47,154,...]` (output of `solana-keygen` or `Keypair.generate()`)

Both are auto-detected at runtime.

## Token priority

1. **UAID** — The native utility token for v402 payments. If the agent wallet holds UAID and the server accepts it, UAID is used.
2. **USDC** — Fallback. Standard SPL USDC on Solana (mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
3. **SOL** — Native SOL transfer (for servers that accept it).

The payment currency is determined by the server's 402 intent (`currency` field). The agent wallet must hold sufficient balance in the requested token.

## v402 vs x402

| | **v402** | **x402** |
|---|---|---|
| **Chain** | Solana (USDC / UAID / SOL) | EVM (ETH / USDC) |
| **Permissions** | Capability-based — each intent scoped to one request | Blanket allowance / approval |
| **Replay protection** | Memo-bound reference per intent; single-use | Nonce-based |
| **Proof of execution** | Server verifies on-chain tx before running the tool | Payment first, hope for execution |
| **Receipts** | Ed25519-signed receipt with requestHash + responseHash | No standard receipt |
| **Custody** | Non-custodial — agent holds keypair, server never sees it | Often requires approval or facilitator |
| **Verification** | On-chain: memo + transfer amount + recipient + expiry | Off-chain or contract-level |
| **Latency** | Solana finality (~400ms) | EVM block time (seconds to minutes) |
| **Agent-native** | Built for AI agents from day one | Adapted from human wallet flows |

## Protocol reference

See `references/v402-protocol.md` in this skill directory for the full protocol specification (request hashing, intents, verification, receipts, policies).

## Files

```
skills/v402-pay/
├── SKILL.md                    # This file
├── scripts/
│   ├── pay.mjs                 # CLI: pay for any v402 endpoint
│   └── setup-wallet.mjs        # CLI: generate agent wallet
├── references/
│   └── v402-protocol.md        # Protocol spec
└── README.md                   # Overview and setup guide
```

## Server-side (for reference)

If you need to protect your own endpoint with v402, use the gateway:

```javascript
import Fastify from "fastify";
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";

const ctx = createGatewayContext(process.env);
const fastify = Fastify({ logger: true });
await v402GatewayFastify(ctx, fastify);

fastify.post("/pay", async (req, reply) => reply.send({ ok: true }));
await fastify.listen({ port: 4040, host: "0.0.0.0" });
```

Required server env: `V402_API_KEY` (or Supabase vars for self-hosted), `SOLANA_RPC_URL`, `USDC_MINT`, `ENCRYPTION_KEY`.
