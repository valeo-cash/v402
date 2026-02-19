# v402 Protocol Specification — v2

**v402pay** is a non-custodial payment protocol for AI agents on Solana. v2 adds tool-aware payment intents, session-based billing, spending policies, and receipt v2.

> **v1 reference**: See `docs/spec.md` for the original specification. v2 is backward-compatible — v1 intents and receipts continue to work.

---

## Overview

- **Non-custodial**: The server never stores or uses user private keys.
- **Settlement**: Solana-native; USDC SPL by default, SOL optional, UAID planned.
- **Tool-aware**: Intents carry `tool_id`, enabling per-tool policies, session billing, and auditing.
- **Session billing**: One payment can cover N tool calls within a session.
- **Flow**: Client calls protected endpoint → 402 + payment intent → client pays via wallet → client retries with proof → server verifies tx, forwards request, returns response + signed receipt.

---

## 1. Protocol Flow

### 1.1 Standard flow (same as v1)

```
Agent                          Gateway                         Solana
  │                              │                               │
  │─── POST /api/tool ──────────▶│                               │
  │◀── 402 + PaymentIntent ─────│                               │
  │                              │                               │
  │─── sign + send tx ──────────────────────────────────────────▶│
  │◀── tx signature ────────────────────────────────────────────│
  │                              │                               │
  │─── POST /api/tool ──────────▶│                               │
  │    + V402-Intent             │─── verify on-chain ──────────▶│
  │    + V402-Tx                 │◀── confirmed ────────────────│
  │    + V402-Request-Hash       │                               │
  │                              │                               │
  │◀── 200 + V402-Receipt ──────│                               │
```

### 1.2 Session billing flow (new in v2)

```
Agent                          Gateway
  │                              │
  │─── POST /api/tool ──────────▶│  (no session header)
  │◀── 402 + Intent (session)───│  (intent includes session_id, max_calls)
  │                              │
  │─── pay on Solana ───────────▶│
  │─── retry with proof ────────▶│  → 200 (calls_used: 1/10)
  │                              │
  │─── POST /api/tool ──────────▶│  (V402-Session: <session_id>)
  │◀── 200 (calls_used: 2/10) ──│  (no new payment required)
  │                              │
  │─── POST /api/tool ──────────▶│  (V402-Session: <session_id>)
  │◀── 200 (calls_used: 3/10) ──│
  │   ...                        │
  │─── POST /api/tool ──────────▶│  (calls_used: 10/10 → exhausted)
  │◀── 402 (new intent) ────────│  (new payment required)
```

---

## 2. Tool-Aware Payment Intent (v2)

Returned with HTTP 402 when the request is unpaid.

### 2.1 Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `intentId` | string (UUID) | Yes | Unique identifier |
| `toolId` | string | Yes | Registered tool identifier |
| `amount` | string (decimal) | Yes | Amount to pay (e.g. `"0.10"`) |
| `currency` | `"USDC"` \| `"SOL"` | Yes | Payment currency |
| `chain` | `"solana"` | Yes | Always `solana` |
| `recipient` | string (base58) | Yes | Merchant wallet address |
| `reference` | string (UUID) | Yes | Memo reference — must appear in tx |
| `expiresAt` | string (ISO 8601) | Yes | Payment deadline |
| `requestHash` | string (hex) | Yes | SHA-256 of canonical request |
| `tool_id` | string | No | Logical tool identifier (e.g. `"web_search"`) |
| `tool_params_hash` | string (hex) | No | SHA-256 of canonical tool parameters |
| `session_id` | string (UUID) | No | Session identifier for multi-call billing |
| `max_calls` | number | No | Max calls covered by this payment |
| `calls_used` | number | No | Calls consumed so far |
| `spending_account` | string (base58) | No | Agent's spending account address |
| `payer` | string (base58) | No | Derived from on-chain tx after verification |
| `mint` | string (base58) | No | SPL token mint address |
| `network` | string | No | `"mainnet-beta"` \| `"devnet"` \| `"testnet"` |

### 2.2 Tool params hash

When present, `tool_params_hash` binds the intent to specific tool parameters. Computed as SHA-256 of the canonical (sorted-key) JSON of the tool call parameters. This prevents an intent paid for one set of parameters from being used with different parameters.

### 2.3 Session ID

When `session_id` is set, the intent covers `max_calls` invocations. After the initial payment:

1. Subsequent requests include `V402-Session: <session_id>` header.
2. Gateway finds the active session intent and checks `calls_used < max_calls`.
3. If allowed, the request is forwarded without new payment; `calls_used` is incremented.
4. When `calls_used >= max_calls`, a new 402 intent is returned.

---

## 3. Request Canonicalization and Hashing

Unchanged from v1 (see `docs/spec.md` §1). SHA-256 over the canonical form of method, path, sorted query, canonical body, and content-type.

---

## 4. Verification (Solana)

Unchanged from v1 (see `docs/spec.md` §3). Key points:

- Memo instruction must contain exactly `v402:<reference>`.
- Payer is **always** derived from the on-chain transaction, never from client headers.
- SOL: payer = fee payer (first signer).
- USDC: payer = owner of the source token account.
- `blockTime` must be <= `expiresAt`.

---

## 5. Receipt v2

### 5.1 Fields

| Field | Type | Description |
|---|---|---|
| `version` | `2` | Receipt format version |
| `intent_id` | string | Intent this receipt covers |
| `tx_signature` | string | Solana transaction signature |
| `amount` | string | Amount paid |
| `currency` | string | `"USDC"` or `"SOL"` |
| `payer` | string | On-chain-derived payer address |
| `merchant` | string | Merchant wallet address |
| `tool_id` | string? | Logical tool identifier |
| `timestamp` | number | Unix timestamp |
| `block_height` | number | Solana block height at confirmation |
| `receipt_hash` | string | SHA-256 of canonical receipt payload |
| `signature` | string | Ed25519 signature over `receipt_hash` |
| `signer_pubkey` | string | Merchant's Ed25519 public key |

### 5.2 Signing

The receipt is signed with the merchant's Ed25519 key:

1. Build canonical receipt payload (sorted keys, stable JSON).
2. Compute `receipt_hash = SHA-256(canonical_payload)`.
3. Sign `receipt_hash` with the merchant's private key.
4. Include `signature` and `signer_pubkey` in the receipt.

Clients verify receipts by: re-computing `receipt_hash` from the payload fields, then verifying the Ed25519 signature against `signer_pubkey`.

---

## 6. Spending Policy

### 6.1 Agent spending policy schema

```typescript
interface AgentSpendingPolicy {
  daily_cap: number;        // Max total spend per UTC day
  per_call_cap?: number;    // Max per individual call
  allowed_tools?: string[]; // Tool ID allowlist (empty = all allowed)
  allowed_merchants?: string[]; // Merchant allowlist
  expiry?: number;          // Unix timestamp when policy expires
}
```

### 6.2 Enforcement

Policies are enforced **after** on-chain payment verification, keyed by the verified **payer** address (never client-supplied):

1. **Per-call cap**: `amount <= per_call_cap`
2. **Daily cap**: `daily_spend + amount <= daily_cap`
3. **Tool allowlist**: `tool_id ∈ allowed_tools` (empty list = no restriction)
4. **Merchant allowlist**: `merchant ∈ allowed_merchants` (empty list = no restriction)
5. **Expiry**: `now < expiry`

If any check fails, the gateway returns 403 with the reason.

### 6.3 Tool-specific policy (`checkToolPolicy`)

Standalone check for whether a specific `tool_id` is permitted by the payer's policy:

- No `tool_id` → allowed (backward compatible with v1 intents).
- No `allowlisted_tool_ids` or empty list → allowed (permissive).
- `tool_id` in list → allowed.
- `tool_id` not in list → rejected with reason `Tool "<tool_id>" not in allowlist`.

---

## 7. Session-Based Billing

### 7.1 Concept

A session intent allows one payment to cover multiple tool calls. The merchant sets `max_calls_per_session` on the route/tool configuration. When a session intent is created:

- `session_id`: UUID generated by the gateway.
- `max_calls`: From the route config.
- `calls_used`: Starts at 0, incremented after each successful call.

### 7.2 Lifecycle

1. **Create**: Gateway creates intent with `session_id` and `max_calls`.
2. **Pay**: Agent pays on Solana and retries. Intent status → `paid_verified`.
3. **Use**: Subsequent requests include `V402-Session` header. Gateway finds the active session, checks `calls_used < max_calls`, forwards, increments.
4. **Exhaust**: When `calls_used >= max_calls`, the session is exhausted. Gateway returns a new 402 intent.

### 7.3 Headers

| Header | Direction | Description |
|---|---|---|
| `V402-Session` | Request | Client sends session ID for session-based billing |
| `V402-Intent` | Request | Intent ID (for paid retry) |
| `V402-Tx` | Request | Transaction signature (for paid retry) |
| `V402-Request-Hash` | Request | Request hash (for paid retry) |
| `V402-Receipt` | Response | Signed receipt (JSON) |

---

## 8. Route Configuration

Server-side configuration for tool-aware billing:

```typescript
interface RouteConfig {
  amount: string;                    // Price per call (or per session)
  currency: 'SOL' | 'USDC';         // Payment currency
  merchant: string;                  // Merchant wallet address
  tool_id?: string;                  // Logical tool identifier
  max_calls_per_session?: number;    // Enable session billing
  require_spending_account?: boolean; // Require spending account field
}
```

---

## 9. Payer Derivation

**Critical security property**: The payer is **always** derived from the verified on-chain transaction, never from any client-supplied header or field.

- **SOL payments**: Payer = transaction fee payer (first signer / `accountKeys[0]`).
- **USDC payments**: Payer = owner of the source token account (the account debited).

This is persisted on the intent and used for all policy enforcement, daily spend tracking, and receipt generation.

---

## 10. v402 vs x402

| | **v402** | **x402** |
|---|---|---|
| **Chain** | Solana (USDC / UAID / SOL) | EVM (ETH / USDC) |
| **Architecture** | Direct on-chain verification via Solana RPC | Requires facilitator service |
| **Permissions** | Capability-based — each intent scoped to one request (or session) | Blanket allowance / approval |
| **Tool awareness** | Built-in: `tool_id`, tool policies, session billing | No tool concept |
| **Replay protection** | Memo-bound reference per intent; single-use | Nonce-based |
| **Proof of execution** | Server verifies on-chain tx before running the tool | Payment first, hope for execution |
| **Receipts** | Ed25519-signed with requestHash + responseHash | No standard receipt format |
| **Policy enforcement** | Built into gateway: daily caps, per-call limits, tool/merchant allowlists | External / none |
| **Custody** | Non-custodial — agent holds keypair, server never sees it | Often requires approval or facilitator |
| **Session billing** | Native: one payment covers N calls | Not supported |
| **Spending accounts** | Agent-delegated spending accounts (planned) | Not applicable |
| **Verification** | On-chain: memo + transfer amount + recipient + expiry | Off-chain or contract-level |
| **Latency** | Solana finality (~400ms) | EVM block time (seconds to minutes) |
| **Agent-native** | Built for AI agents from day one | Adapted from human wallet flows |

---

## 11. Database Schema (v2 additions)

New columns on `payment_intents`:

```sql
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS tool_params_hash TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS max_calls INTEGER;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS calls_used INTEGER DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS spending_account TEXT;

CREATE INDEX IF NOT EXISTS idx_intents_session_id
  ON payment_intents(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intents_tool_id
  ON payment_intents(tool_id) WHERE tool_id IS NOT NULL;
```

---

## 12. References

- v402 v1 spec: `docs/spec.md`
- Memo program: [Solana Memo Program](https://spl.solana.com/memo)
- HTTP 402: RFC 7231
- USDC: Circle SPL token; mainnet mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Ed25519: RFC 8032
