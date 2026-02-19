# @v402pay/sdk

Client SDK for the v402 payment protocol — handles the 402 → pay → retry flow with wallet adapters.

## Install

```bash
npm install @v402pay/sdk
```

## Usage

```typescript
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";

const adapter = createKeypairAdapter({ keypair, rpcUrl });
const { fetch } = createV402Client({ walletAdapter: adapter });

// Automatically handles 402 → pay on Solana → retry with proof → 200
const res = await fetch("https://api.example.com/tool", { method: "POST", body: "{}" });
console.log(res.status); // 200
```

## CLI

```bash
npx @v402pay/sdk https://api.example.com/tool
```

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)
- [Protocol spec](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
