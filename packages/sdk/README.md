# @v402pay/sdk

Client for the v402pay protocol: on 402, pay with a wallet adapter then retry with payment headers.

## Install

```bash
npm install @v402pay/sdk
```

Peer dependencies (optional): `@solana/web3.js`, `@solana/spl-token` (for USDC).

## Usage

```ts
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

const adapter = createKeypairAdapter({
  keypair: myKeypair,
  rpcUrl: "https://api.devnet.solana.com",
});
const { fetch } = createV402Client({ walletAdapter: adapter });
const res = await fetch("https://api.example.com/pay", {
  method: "POST",
  body: JSON.stringify({}),
});
// 402 → pay → retry; res.status === 200 with V402-Receipt header
```

Adapters: `createKeypairAdapter` (Node), Wallet Standard (browser). All payments include memo `v402:<reference>`.
