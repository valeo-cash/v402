# v402 Protocol Reference

This is a condensed protocol reference for AI agents using the v402-pay skill. For the full specification, see `docs/spec.md` in the repository root.

## Overview

v402 is a non-custodial payment protocol for AI agents on Solana. It uses HTTP 402 (Payment Required) to gate API access. Settlement is real (USDC SPL, UAID SPL, or SOL) and verified on-chain.

## Flow

```
Agent                          Server (v402 Gateway)           Solana
  │                                  │                           │
  │─── POST /api/tool ──────────────▶│                           │
  │◀── 402 + PaymentIntent ─────────│                           │
  │                                  │                           │
  │─── sign + send tx ──────────────────────────────────────────▶│
  │◀── tx signature ────────────────────────────────────────────│
  │                                  │                           │
  │─── POST /api/tool ──────────────▶│                           │
  │    + V402-Intent header          │─── verify tx on-chain ──▶│
  │    + V402-Tx header              │◀── confirmed ────────────│
  │    + V402-Request-Hash header    │                           │
  │                                  │                           │
  │◀── 200 + V402-Receipt ──────────│                           │
```

## Payment Intent (402 response body)

When a request hits a protected endpoint without payment proof, the server returns HTTP 402 with a JSON body:

```json
{
  "intentId": "uuid",
  "toolId": "registered-tool-id",
  "amount": "0.10",
  "currency": "USDC",
  "chain": "solana",
  "recipient": "SolanaBase58Address",
  "reference": "unique-reference-string",
  "expiresAt": "2025-01-01T00:00:00Z",
  "requestHash": "sha256hex",
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "network": "mainnet-beta"
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `intentId` | string (UUID) | Unique identifier for this payment intent |
| `toolId` | string | Registered tool/endpoint identifier |
| `amount` | string (decimal) | Amount to pay (e.g. `"0.10"` for 0.10 USDC) |
| `currency` | `"USDC"` \| `"SOL"` | Payment currency |
| `chain` | `"solana"` | Always `solana` |
| `recipient` | string (base58) | Merchant's Solana wallet address |
| `reference` | string | Unique reference — must appear in the Memo instruction |
| `expiresAt` | string (ISO 8601) | Payment deadline |
| `requestHash` | string (hex) | SHA-256 of the canonical request |
| `mint` | string (base58) | SPL token mint address (for USDC/UAID) |
| `network` | string | `"mainnet-beta"` \| `"devnet"` \| `"testnet"` |

## Request Canonicalization

The `requestHash` is a SHA-256 hex digest of the canonical request form:

```
METHOD\n
NORMALIZED_PATH\n
SORTED_QUERY_STRING\n
CANONICAL_BODY\n
CONTENT_TYPE
```

- **Method**: Uppercase (e.g. `POST`)
- **Path**: No trailing slash, no duplicate slashes
- **Query**: Keys sorted by byte order, joined with `&`
- **Body**: JSON bodies are re-serialized with sorted keys; non-JSON uses raw bytes
- **Content-Type**: Exact header value or empty string

## Payment Transaction

The agent must send a Solana transaction containing:

1. **Transfer instruction** — Move the requested amount to the `recipient`:
   - **USDC/UAID (SPL)**: Token transfer to recipient's associated token account
   - **SOL**: System transfer

2. **Memo instruction** — Must include exactly `v402:<reference>` using the Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).

Both instructions must be in the same transaction.

## Retry Headers

After payment, retry the original request with these headers:

| Header | Value |
|---|---|
| `V402-Intent` | The `intentId` from the 402 response |
| `V402-Tx` | The Solana transaction signature |
| `V402-Request-Hash` | The `requestHash` from the 402 response |

## Verification

The gateway verifies:

1. Transaction is confirmed on-chain
2. Memo contains `v402:<reference>` matching the intent
3. Transfer amount >= intent amount to correct recipient
4. For SPL tokens: mint matches the configured mint
5. `blockTime` <= `expiresAt`
6. Intent is not already consumed (single-use)
7. Payer policy checks pass (spend limits, allowlists)

## Receipts

On success, the server returns HTTP 200 with a `V402-Receipt` header containing an Ed25519-signed receipt:

```json
{
  "receiptId": "uuid",
  "intentId": "uuid",
  "toolId": "tool-id",
  "requestHash": "sha256hex",
  "responseHash": "sha256hex",
  "txSig": "solana-tx-signature",
  "payer": "payer-solana-address",
  "merchant": "merchant-solana-address",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

Receipts are signed with the merchant's Ed25519 key and can be independently verified.

## Idempotency

If a consumed intent is replayed with the same `V402-Request-Hash`, the gateway returns the stored original response and receipt without calling the upstream again.

## Policy

Policies are enforced per payer (derived from the verified transaction, never from the client):

- `maxSpendPerCall` — Maximum amount per single payment
- `maxSpendPerDay` — Daily spend cap (UTC)
- `allowlistedToolIds` — Only these tools can be called
- `allowlistedMerchants` — Only these merchants can receive payment

## Token Addresses

| Token | Mint Address | Network |
|---|---|---|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Mainnet |
| UAID | Set via `UAID_MINT` env var | Mainnet |

## Key Programs

| Program | Address |
|---|---|
| Memo | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` |
| Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| System | `11111111111111111111111111111111` |

## SDK Quick Reference

### Client

```javascript
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

const adapter = createKeypairAdapter({ keypair, rpcUrl });
const { fetch } = createV402Client({ walletAdapter: adapter });
const res = await fetch(url, { method: "POST", body: JSON.stringify(data) });
```

### Client options

```typescript
type V402ClientOptions = {
  walletAdapter: V402WalletAdapter;  // required
  fetch?: typeof globalThis.fetch;   // custom fetch implementation
  payerPublicKey?: string;           // override payer identity
  paymentTimeout?: number;           // ms to wait for payment
  onBeforePay?: (intent: PaymentIntent) => boolean | Promise<boolean>;
};
```

### Gateway (server-side)

```javascript
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";

const ctx = createGatewayContext(process.env);
await v402GatewayFastify(ctx, fastify);
```
