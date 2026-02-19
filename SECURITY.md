# Security

## Non-custodial design

v402pay is **non-custodial**. The gateway and web app never hold or transmit user private keys. Payment is made by the client (wallet) directly to the merchant's on-chain address. The server only verifies that a valid transaction occurred and issues a receipt.

## Threat model

| Attack | Mitigation | Status |
|---|---|---|
| **Replay attacks** | Memo-bound idempotency: each intent has a unique `reference` embedded in a Memo instruction. Once consumed, the same intent + request hash returns the stored response — no second payment, no re-execution. | Implemented |
| **MITM (man-in-the-middle)** | HTTPS required in production. Receipts are Ed25519-signed with the merchant's key, so tampered responses are detectable by verifying the signature. | Implemented |
| **Payer spoofing** | Payer is **always** derived from the verified on-chain transaction (fee payer for SOL, source token account owner for USDC), never from client-supplied headers. | Implemented |
| **RPC manipulation** | Single-RPC verification is the default. For high-value transactions, operators should verify via multiple independent RPC endpoints. | Documented |
| **Key compromise (merchant)** | Rotate the merchant's Ed25519 signing key in the dashboard. Old receipts remain verifiable with the old public key; new intents use the new key. Revoke the old key to prevent new metadata signatures. | Procedure documented |
| **Key compromise (agent wallet)** | Agent wallets are non-custodial keypairs. If compromised, stop using the wallet and create a new one. v402 does not store or manage agent keys. | Procedure documented |
| **Malicious upstream tool** | v402 does **not** inspect or sanitize the tool's response. It only attests that payment was verified and returns the upstream response. Tool output is the responsibility of the tool operator. | Out of scope |
| **Rate limit abuse** | Intent creation is rate-limited per client (IP / key). Configurable via `V402_INTENT_RATE_LIMIT` and `V402_INTENT_RATE_WINDOW_MS`. | Implemented |
| **Overspend** | Policy enforcement: per-call caps (`maxSpendPerCall`), daily caps (`maxSpendPerDay`), tool allowlists, merchant allowlists. Policies are checked after on-chain verification, keyed by the verified payer address. | Implemented |
| **Intent expiry bypass** | The gateway checks `blockTime` of the transaction against the intent's `expiresAt`. Payments confirmed after expiry are rejected. | Implemented |

## Memo requirement

Every payment transaction **must** include a Memo instruction with data `v402:<reference>` where `<reference>` is the intent reference (Memo program: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`). The gateway rejects transactions that do not contain this memo. This binds the payment to the specific 402 intent and prevents reuse of unrelated payments.

## Replay behavior

Once a request (identified by intent + request hash) has been paid and the response stored, the gateway replays that stored response for subsequent requests with the same intent and request hash. No second payment is required. Receipts are idempotent by (intent, request hash).

## Policy enforcement

- Policies (max spend per call/day, allowlists) are enforced **after** on-chain payment verification.
- Payer is derived only from the verified transaction, not from headers.
- Daily spend is tracked per payer and UTC date.
- Negative amounts are rejected by input validation.

## Known limitations

v402 is a payment verification and receipt protocol. It **does not** protect against:

- **Malicious or buggy upstream tools**: The gateway does not inspect or sanitize the tool's response. It only attests that payment was verified and returns the upstream response. Tool output is the responsibility of the tool operator.
- **Tool metadata integrity at runtime**: Tool metadata (name, URL, pricing) is signed by the merchant at creation. The gateway verifies this signature before creating intents. However, it does not verify that the tool's runtime behavior matches the metadata (e.g., a tool could return different results than advertised).
- **Network-level attacks**: Use HTTPS in production. v402 does not provide transport security. Without TLS, payment intents and receipts could be intercepted.
- **Agent wallet compromise**: v402 is non-custodial — if an agent's keypair is compromised, the attacker can spend funds. Key hygiene and secure storage are the agent operator's responsibility.
- **Solana RPC reliability**: v402 depends on Solana RPC for transaction verification. If the configured RPC endpoint is unreliable, unresponsive, or malicious, verification could fail or be spoofed. Use trusted RPC providers; for high-value operations, verify against multiple endpoints.
- **Price oracle manipulation**: v402 accepts the amount specified in the tool metadata. It does not verify that the price is fair or current. Dynamic pricing is the tool operator's responsibility.

## Responsible disclosure

Please report security vulnerabilities privately at **security@valeo.cash** rather than in public issues. We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 7 days.

If the vulnerability is critical (e.g., allows unauthorized fund transfers or receipt forgery), please include:

1. Steps to reproduce
2. Impact assessment
3. Suggested fix (if any)

We do not currently operate a bug bounty program but may offer recognition for significant findings.
