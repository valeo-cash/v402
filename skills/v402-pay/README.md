# v402-pay — Agent Skill

An OpenClaw agent skill for paying v402-protected API endpoints using UAID/USDC on Solana. Non-custodial, keypair-based, real on-chain settlement.

## One-prompt install

Paste this into any OpenClaw-compatible AI agent:

> Read https://raw.githubusercontent.com/valeo-cash/v402/main/skills/v402-pay/SKILL.md and install it.

## What's inside

```
skills/v402-pay/
├── SKILL.md                    # OpenClaw-compatible skill definition
├── scripts/
│   ├── pay.mjs                 # CLI: pay for any v402 endpoint
│   └── setup-wallet.mjs        # CLI: generate a Solana agent wallet
├── references/
│   └── v402-protocol.md        # v402 protocol specification reference
└── README.md                   # This file
```

## Prerequisites

- Node.js 20+
- `@v402pay/sdk` and `@solana/web3.js` installed (see monorepo root)
- A funded Solana wallet (UAID or USDC on mainnet, SOL on devnet)

## Setup

### 1. Generate an agent wallet

```bash
node skills/v402-pay/scripts/setup-wallet.mjs
```

Creates `.v402-agent-wallet.json` in the current directory containing the secret key as a JSON byte array. Add this file to `.gitignore`.

### 2. Fund the wallet

Transfer UAID (preferred) or USDC to the public key printed by the setup script. For devnet testing, airdrop SOL:

```bash
solana airdrop 2 <PUBLIC_KEY> --url devnet
```

### 3. Call a paid endpoint

```bash
V402_AGENT_KEY=$(cat .v402-agent-wallet.json) \
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
  node skills/v402-pay/scripts/pay.mjs https://api.example.com/pay '{"query":"hello"}'
```

The script handles the full flow: initial request -> 402 -> pay on Solana -> retry with proof -> 200 with receipt.

## How it works

1. The agent sends a request to a v402-protected endpoint.
2. The server returns HTTP 402 with a payment intent (amount, recipient, reference).
3. The SDK signs and sends a Solana transaction (SPL transfer + memo).
4. The SDK retries the request with `V402-Intent`, `V402-Tx`, and `V402-Request-Hash` headers.
5. The gateway verifies the transaction on-chain and returns 200 with a signed `V402-Receipt`.

No custodial services. No Privy. No facilitator. The agent holds its own keypair and signs transactions locally.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `V402_AGENT_KEY` | Yes | — | Secret key (base58 or JSON byte array) |
| `SOLANA_RPC_URL` | Yes | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `UAID_MINT` | No | — | UAID SPL token mint address |
| `USDC_MINT` | No | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | USDC mint |

## Secret key formats

Both scripts accept `V402_AGENT_KEY` in two formats:

- **JSON byte array**: `[174,47,154,16,...]` — output of `setup-wallet.mjs` and `solana-keygen`
- **Base58 string**: `5KQwrPbwd2tz...` — standard Solana CLI export format

Auto-detected at runtime. No configuration needed.

## Using in your own code

```javascript
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

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
  rpcUrl: process.env.SOLANA_RPC_URL,
});

const { fetch } = createV402Client({ walletAdapter: adapter });

const res = await fetch("https://api.example.com/pay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "hello" }),
});

console.log(res.status);
console.log(res.headers.get("V402-Receipt"));
console.log(await res.json());
```

## v402 vs x402

| | v402 | x402 |
|---|---|---|
| Chain | Solana | EVM |
| Tokens | UAID / USDC / SOL | ETH / USDC |
| Permissions | Capability-based (per-request) | Blanket approval |
| Receipts | Ed25519-signed (requestHash + responseHash) | None |
| Custody | Non-custodial keypair | Often requires facilitator |
| Finality | ~400ms (Solana) | Seconds to minutes |
| Built for | AI agents | Adapted from human flows |

## Links

- [v402 repository](https://github.com/valeo-cash/v402)
- [@v402pay/sdk on npm](https://www.npmjs.com/package/@v402pay/sdk)
- [@v402pay/gateway on npm](https://www.npmjs.com/package/@v402pay/gateway)
