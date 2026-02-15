# @v402pay/sdk

[![npm version](https://img.shields.io/npm/v/@v402pay/sdk.svg)](https://www.npmjs.com/package/@v402pay/sdk)

Client for the **v402pay** protocol: on **402 Payment Required**, pay with a wallet adapter (Solana), then retry the request with payment headers. The server verifies the on-chain payment and returns the resource (and optionally a signed receipt).

## Install

```bash
npm install @v402pay/sdk
```

Peer dependencies (for paying on Solana):

```bash
npm install @solana/web3.js @solana/spl-token
```

Use **Keypair adapter** in Node (e.g. scripts, tests); use **Wallet Standard** in the browser (e.g. Phantom).

## End-to-end example

### Node (Keypair adapter)

```ts
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate(); // or load from env
const adapter = createKeypairAdapter({
  keypair,
  rpcUrl: "https://api.devnet.solana.com",
});

const { fetch } = createV402Client({
  walletAdapter: adapter,
  payerPublicKey: keypair.publicKey.toBase58(),
});

const res = await fetch("https://api.example.com/pay", {
  method: "POST",
  body: JSON.stringify({ query: "foo" }),
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);
const receipt = res.headers.get("V402-Receipt"); // optional signed receipt
const data = await res.json();
```

### Browser (Wallet Standard / Phantom)

```ts
import { createV402Client, createWalletStandardAdapter } from "@v402pay/sdk";

const adapter = createWalletStandardAdapter();
const { fetch } = createV402Client({ walletAdapter: adapter });

const res = await fetch("https://api.example.com/pay", { method: "GET" });
// 402 → wallet prompts to pay → retry with headers → 200
const receipt = res.headers.get("V402-Receipt");
```

Flow: first request returns **402** with `PaymentIntent` JSON; the client calls `walletAdapter.pay()`; then the client retries the same request with `V402-Intent`, `V402-Tx`, and `V402-Request-Hash` headers; the server verifies and responds with **200** (and optionally attaches a receipt).

## Error handling

The SDK throws `V402PaymentError` with a `code` and optional `cause`:

```ts
import { createV402Client, V402PaymentError } from "@v402pay/sdk";

try {
  const res = await v402Fetch("https://api.example.com/pay");
} catch (err) {
  if (err instanceof V402PaymentError) {
    switch (err.code) {
      case "INTENT_EXPIRED":
        // intent.expiresAt has passed
        break;
      case "INVALID_INTENT":
        // malformed or missing required fields in 402 body
        break;
      case "PAYMENT_FAILED":
        // walletAdapter.pay() threw or timed out, or onBeforePay returned false
        break;
      case "RETRY_FAILED":
        // retry request returned non-2xx
        break;
    }
    console.error(err.message, err.cause);
  }
  throw err;
}
```

## `onBeforePay` hook

Use `onBeforePay` to gate payments (spend limits, user confirmation, allowlists):

```ts
const { fetch } = createV402Client({
  walletAdapter: adapter,
  onBeforePay: async (intent) => {
    const { parseAmount } = await import("@v402pay/core");
    if (Number(parseAmount(intent.amount, 6)) > 100_000_000) return false; // e.g. 100 USDC (6 decimals)
    return confirm(`Pay ${intent.amount} ${intent.currency}?`);
  },
});
```

Return `false` (or a promise that resolves to `false`) to abort before calling `walletAdapter.pay()`.

## Options

- `paymentTimeout` – timeout in ms for the payment step (default: no timeout).
- `payerPublicKey` – optional; used for client-side checks.
- `fetch` – optional custom `fetch` (e.g. for testing or custom base URL).

All payments include a memo `v402:<reference>` for idempotency and tracing.
