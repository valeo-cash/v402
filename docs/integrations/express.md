# Express integration

Use `@v402pay/gateway` with Express. Ensure the raw body is available for request hashing (buffer before JSON parser).

## Setup

```bash
pnpm add express @v402pay/gateway
```

## Example

```javascript
const express = require("express");
const { createGatewayContext, v402Gateway, rawBodyParser } = require("@v402pay/gateway");

const app = express();

// Preserve raw body for hashing (use before json())
app.use(express.json({ verify: rawBodyParser }));

const ctx = createGatewayContext(process.env);
app.use(v402Gateway(ctx));

// Your paid route
app.post("/api/tool/run", (req, res) => {
  res.json({ result: "ok" });
});

app.listen(3000);
```

## Environment

- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key (gateway uses it to read/write intents, receipts, policies)
- `SOLANA_RPC_URL` – Helius or other RPC
- `USDC_MINT` – Mainnet USDC mint
- `ENCRYPTION_KEY` – 32-byte hex for decrypting merchant signing keys

## Headers

When the client pays and retries, it sends:

- `V402-Intent` – intent ID
- `V402-Tx` – transaction signature
- `V402-Request-Hash` – SHA-256 hex of canonical request

The gateway verifies the tx, derives the payer from the transaction, enforces policies, forwards the request, stores the response on the receipt, and returns the response with `V402-Receipt`.
