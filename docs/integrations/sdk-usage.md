# SDK usage

Use `@v402pay/sdk` to call paid endpoints: on 402, the client parses the intent, asks the wallet to pay, then retries with proof.

## Install

```bash
pnpm add @v402pay/sdk @solana/web3.js @solana/spl-token
```

## Browser (Phantom / Wallet Standard)

```javascript
import { createV402Client, createWalletStandardAdapter } from "@v402pay/sdk";

const adapter = createWalletStandardAdapter({ rpcUrl: "https://api.mainnet-beta.solana.com" });
const { fetch } = createV402Client({ walletAdapter: adapter });

const res = await fetch("https://api.example.com/api/tool/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ input: "hello" }),
});

const data = await res.json();
// res.headers.get("V402-Receipt") contains the receipt if payment was required
```

## Node (dev only – Keypair)

**Unsafe for production.** Use only for local testing.

```javascript
const { Keypair } = require("@solana/web3.js");
const { createV402Client, createKeypairAdapter } = require("@v402pay/sdk");

const keypair = Keypair.generate();
const adapter = createKeypairAdapter({
  keypair,
  rpcUrl: process.env.SOLANA_RPC_URL,
});

const { fetch } = createV402Client({ walletAdapter: adapter });
const res = await fetch("https://api.example.com/api/tool/run", { method: "POST" });
```

## Memo requirement

The wallet must include a **Memo program** instruction with content exactly `v402:<reference>` where `<reference>` is the intent’s `reference`. The SDK adapters (Keypair, Wallet Standard) add this instruction when building the transfer transaction.
