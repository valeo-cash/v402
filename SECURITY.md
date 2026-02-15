# Security

## Non-custodial

v402pay is **non-custodial**. The gateway and web app never hold or transmit user private keys. Payment is made by the client (wallet) directly to the merchant’s on-chain address. The server only verifies that a valid transaction occurred and issues a receipt.

## Memo requirement

Every payment transaction **must** include a Memo instruction with data `v402:<reference>` where `<reference>` is the intent reference. The gateway rejects transactions that do not contain this memo. This binds the payment to the specific 402 intent and prevents reuse of unrelated payments.

## Replay behavior

Once a request (identified by intent + request hash) has been paid and the response stored, the gateway replays that stored response for subsequent requests with the same intent and request hash. No second payment is required. Receipts are idempotent by (intent, request hash).

## Policy enforcement

- Policies (max spend per call/day, allowlists) are enforced **after** on-chain payment verification.
- Payer is derived only from the verified transaction, not from headers.
- Daily spend is tracked per payer and UTC date.

## What the gateway does NOT protect against

- **Malicious or buggy upstream tools**: The gateway does not inspect or sanitize the tool’s response. It only attests that payment was verified and returns the upstream response. Tool output is the responsibility of the tool operator.
- **Tool metadata integrity**: Tool metadata (name, URL, pricing) is signed by the merchant. The gateway verifies this signature. It does not verify that the tool’s runtime behavior matches the metadata.
- **Network / MITM**: Use HTTPS in production. The gateway does not provide transport security.
- **Key compromise**: If a merchant’s signing key (encrypted at rest) or a user’s wallet is compromised, an attacker can sign tool metadata or spend funds. Key hygiene and access control are the deployer’s responsibility.

## Reporting vulnerabilities

Please report security issues privately (e.g. via maintainer contact or security policy on the repository) rather than in public issues.
