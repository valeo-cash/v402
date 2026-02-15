# @v402pay/core

Types, canonicalization, hashing, Solana payment verification, and receipt/tool metadata signing for the v402pay protocol.

## Install

```bash
npm install @v402pay/core
```

## Exports

- **Types**: `PaymentIntent`, `ReceiptPayload`, `SolanaVerifyConfig`, `ToolMetadataInput`, etc.
- **Canonical**: `buildCanonicalRequest`, `stableStringify`, `canonicalToolMetadata`
- **Hash**: `requestHash`, `sha256Hex`
- **Solana**: `verifySolanaPayment`, `USDC_DECIMALS`, `MEMO_PROGRAM_ID`, `hasV402Memo`, `extractMemoReference`
- **Receipt**: `signReceipt`, `verifyReceiptSignature`, `signEd25519Message`, `verifyEd25519Message`

Used by `@v402pay/sdk` and `@v402pay/gateway`.
