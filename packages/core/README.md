# @v402pay/core

[![npm version](https://img.shields.io/npm/v/@v402pay/core.svg)](https://www.npmjs.com/package/@v402pay/core)

Types, canonicalization, hashing, Solana payment verification, and receipt/tool metadata signing for the **v402pay** protocol. The protocol works as follows: the client makes an HTTP request; the server may respond with **402 Payment Required** and a `PaymentIntent` JSON body; the client pays on Solana (SOL or USDC) and retries the request with payment headers (`V402-Intent`, `V402-Tx`, `V402-Request-Hash`); the server verifies the on-chain payment and responds with the actual resource (and optionally a signed receipt).

## Install

```bash
npm install @v402pay/core
```

## Exports (grouped)

### Types

- `PaymentIntent`, `Currency`, `Chain`, `SolanaNetwork`
- `V402PaymentHeaders`, `V402Response`
- `ReceiptPayload`, `ToolMetadataPayload`, `Policy`, `VerifiedPayment`
- `V402_MEMO_PREFIX`

### Canonical

- `buildCanonicalRequest` – build canonical request string for hashing
- `stableStringify` – deterministic JSON stringify
- `canonicalToolMetadata` – canonical tool metadata string

### Hash

- `requestHash(canonicalRequest)` – SHA-256 hex of canonical request
- `sha256Hex(input)` – SHA-256 hex of string or bytes

### Solana

- `verifySolanaPayment(intent, txSig, rpcUrl, config?)` – verify SOL or USDC payment on Solana
- `SolanaVerifyConfig`, `USDC_DECIMALS`, `SOL_DECIMALS`
- `MEMO_PROGRAM_ID`, `hasV402Memo`, `extractMemoReference`
- `parseAmount(amount, decimals)` – safe decimal → atomic units (bigint)

### Receipt

- `signReceipt`, `verifyReceiptSignature`
- `signEd25519Message`, `verifyEd25519Message`

### Tool metadata

- `canonicalToolMetadata`, `ToolMetadataInput`

## Example: verify a Solana payment

```ts
import { verifySolanaPayment, type PaymentIntent } from "@v402pay/core";

const intent: PaymentIntent = { /* from 402 response */ };
const txSig = "5J7..."; // from wallet after pay
const rpcUrl = "https://api.mainnet-beta.solana.com";

const verified = await verifySolanaPayment(intent, txSig, rpcUrl);
console.log(verified.payer, verified.txSig, verified.blockTime);
```

## Spec / docs

- [Protocol spec](https://github.com/valeo-cash/v402) (repo and documentation)

Used by `@v402pay/sdk` and `@v402pay/gateway`.
