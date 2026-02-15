# v402 Protocol Specification

**v402pay** is a non-custodial payments and execution protocol for AI agents on Solana. It uses HTTP 402 (Payment Required) to request payment; settlement is real (USDC SPL or SOL) and verified on-chain.

## Overview

- **Non-custodial**: The server never stores or uses user private keys.
- **Settlement**: Solana native; USDC SPL by default, SOL optional.
- **Flow**: Client calls protected endpoint → 402 + payment intent → client pays via wallet → client retries with proof → server verifies tx, forwards request, returns response + receipt.

---

## 1. Request Canonicalization and Hashing

Request hashing must be **deterministic** across SDK and gateway so the same request produces the same `requestHash`.

### 1.1 Canonical representation

Build a single string (or buffer) in this order:

1. **Method**: Uppercase HTTP method (e.g. `GET`, `POST`).
2. **Normalized path**: URL path, normalized:
   - No trailing slash (unless path is exactly `/`).
   - No duplicate slashes.
   - Percent-encoding normalized (uppercase hex, reserved chars encoded per RFC 3986).
3. **Query string**: Sorted by key (byte order), then `key=value` pairs joined by `&`. No fragment.
4. **Body part** (see 1.2).
5. **Content-Type**: Exact value of `Content-Type` header, or empty string if absent.

Delimiter between segments: newline `\n` (or a single byte 0x0A). No leading/trailing newlines between segments.

Example (no body): `GET\n/api/tool\n\n\n`

### 1.2 Body handling (deterministic)

- **JSON bodies** (when `Content-Type` is `application/json` or ends with `+json`):
  - Parse the raw body as JSON.
  - Produce canonical JSON: **stable stringify with sorted object keys** (recursive, depth-first). No extra whitespace.
  - The body part in the canonical representation is this string (UTF-8).
  - Gateway must **buffer the raw body** to compute the hash, then **forward the same raw body unchanged** to the upstream.

- **Non-JSON bodies** (any other `Content-Type` or no body):
  - Body part = **raw bytes of the body** (as received). If no body, body part is empty.
  - Include the exact `Content-Type` in the final segment so that different content types produce different hashes.

This ensures SDK and gateway can reproduce the same canonical form: SDK uses the same method, path, query, body rules, and content-type.

### 1.3 Hash

- Compute **SHA-256** over the canonical representation (UTF-8 for the string form).
- Output: **hex-encoded** string (lowercase).
- Header name: `V402-Request-Hash` (and optionally in intent/receipt payloads).

### 1.4 Test vector (cross-package)

SDK and gateway must produce the same hash for the same inputs. Use this vector to verify:

- **Input**: method `GET`, path `/api/tool`, query `{ "b": "2", "a": "1" }`, no body, no content-type.
- **Canonical string**: `GET\n/api/tool\na=1&b=2\n\n\n`
- **Expected requestHash**: computed in `@v402pay/core` test `canonical.test.ts` (cross-package test vector). SDK and gateway use the same `buildCanonicalRequest` + `requestHash` from core, so hashes match.

---

## 2. Payment Intent

Returned with HTTP 402 when the request is unpaid.

- **intentId**: UUID.
- **toolId**: Registered tool identifier.
- **amount**: Decimal string (e.g. `"0.10"` for USDC, or lamports as decimal for SOL).
- **currency**: `USDC` | `SOL`.
- **chain**: `solana`.
- **recipient**: Solana address (base58) of the merchant wallet.
- **reference**: Unique string binding this intent (e.g. UUID). **Must** appear in the Memo instruction (see §5).
- **expiresAt**: ISO 8601 timestamp; payment must be confirmed before this time.
- **requestHash**: SHA-256 hex of the canonical request (see §1).

The gateway only creates intents for **registered, active tools with a valid metadata_signature** (see §8).

---

## 3. Verification (Solana)

After the client submits a transaction, the gateway verifies it via RPC.

### 3.1 Fetch

- Call `getTransaction(signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 })`.
- Transaction must be **confirmed** (or stricter, e.g. finalized) per gateway config.

### 3.2 Memo (mandatory)

- There must be at least one **Memo program** instruction in the transaction.
- Memo program id: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` (mainnet) or same on devnet.
- One of the memo instructions must contain **exactly** the UTF-8 string: `v402:<reference>` where `<reference>` is the intent’s `reference` value.
- **No fallback**: If no such memo is found, verification fails. Do not use “match by amount/recipient only” or “recent txs”.

### 3.3 Transfer checks

- **USDC (SPL Token)**:
  - Find the transfer instruction that moves tokens to the intent’s `recipient` (or to the recipient’s associated token account for the USDC mint).
  - Amount (in token decimals) must be >= intent amount.
  - Mint must match configured USDC mint.
  - **Payer derivation**: The **owner of the source token account** (the account debited) is the **payer**. Persist this as `payer` on the payment intent; use it for policy and receipts.
- **SOL (native)**:
  - Find the system transfer instruction to the intent’s `recipient`.
  - Lamports must be >= intent amount (in lamports).
  - **Payer derivation**: Use the **transaction fee payer** (first signer / account that pays fees) as the **payer**. Persist and use for policy and receipts.

### 3.4 Time and replay

- **blockTime** of the transaction must be <= intent’s `expiresAt`.
- Each intent is single-use: once status is `consumed`, the same intent + request must be idempotent (return stored response + receipt; see §6).

---

## 4. Policy Enforcement

- **Payer** is **never** taken from the client. It is **always** derived from the verified transaction (§3.3) and persisted on the payment intent.
- Policies are keyed by **payer** (Solana address) or by API key when applicable.
- Before accepting a paid retry: load policy by **verified payer**; enforce:
  - `maxSpendPerCall`
  - `maxSpendPerDay` (UTC day, via `daily_spend` table)
  - `allowlistedToolIds` / `allowlistedMerchants` if set
- If any check fails, return 403 (or 402 with updated intent if applicable).

---

## 5. Idempotency and Stored Response

- When an intent is already **consumed**, a repeat request with the same intent and same `V402-Request-Hash` must **not** call the upstream again.
- The gateway returns:
  - The **stored original response**: status code, headers, body (from the `receipts` row: `response_status`, `response_headers`, `response_body`).
  - The receipt (same as before).
- Receipts table must store: `response_status` (int), `response_headers` (jsonb), `response_body` (text or bytea) so the exact response can be replayed.

---

## 6. Receipts

- Issued after successful payment verification and upstream call (or replayed from store).
- Fields: receiptId, intentId, toolId, requestHash, responseHash, txSig, payer, merchant, timestamp.
- **responseHash**: SHA-256 hex of the **canonical response** (e.g. status + headers + body; define a canonical form for responses if needed for auditing).
- **serverSig**: Ed25519 signature over a canonical receipt payload, using the merchant’s signing key (decrypted server-side only). Verifiable with the merchant’s public key.

---

## 7. Merchant Signing and Tool Trust

- Merchants have a **platform-generated** Ed25519 keypair. Private key is **encrypted at rest** (e.g. with ENCRYPTION_KEY); only the server decrypts to sign.
- **Tool metadata** is signed at creation/update; signature stored as `metadata_signature`. Gateway **only** creates intents for tools whose `metadata_signature` verifies against the merchant’s public key.
- **Receipts** are signed with the same (or designated) merchant key. Webapp shows **signed/verified** status and the merchant’s public key.

---

## 8. Headers

- **402 response**: Body is JSON (intent). Headers may include `V402-Intent: <intentId>`.
- **Paid retry**: Client sends:
  - `V402-Intent: <intentId>`
  - `V402-Tx: <transactionSignature>`
  - `V402-Request-Hash: <requestHash>`
- Response may include receipt in body or header (e.g. `V402-Receipt` or in JSON body).

---

## 9. References

- Memo program: [Solana Memo Program](https://spl.solana.com/memo)
- HTTP 402: RFC 7231
- USDC: Circle SPL token; mint per chain (e.g. mainnet `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
