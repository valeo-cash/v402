# @v402pay/core

Crypto primitives, types, hashing, Solana verification, and receipt signing for the v402 payment protocol.

## Install

```bash
npm install @v402pay/core
```

## Usage

```typescript
import { requestHash, verifySolanaPayment, signReceipt } from "@v402pay/core";

// Hash a request for intent binding
const hash = requestHash("POST", "/api/tool", "", '{"q":"hello"}', "application/json");

// Verify a Solana payment matches an intent
const result = await verifySolanaPayment({ txSig, intent, rpcUrl, usdcMint });

// Sign a receipt with Ed25519
const sig = await signReceipt(receiptPayload, privateKeySeed);
```

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)
- [Protocol spec](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
