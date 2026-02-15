# @v402pay/gateway

Gateway middleware for v402pay: intent creation, payment verification, policy checks, receipt issuance. Supports Express, Fastify, and Next.js.

## Install

```bash
npm install @v402pay/gateway
```

Peer dependencies (optional): `express`, `fastify`, or `next` depending on your stack. For Next.js App Router, import from `@v402pay/gateway/next`: `import { withV402Gateway } from "@v402pay/gateway/next"`.

## Env

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` – Supabase project
- `SOLANA_RPC_URL`, `USDC_MINT` – Solana RPC and USDC mint
- `ENCRYPTION_KEY` – 32-byte hex for encrypting merchant signing keys

## Usage (Fastify)

```ts
import Fastify from "fastify";
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";

const ctx = createGatewayContext(process.env);
const fastify = Fastify();
await v402GatewayFastify(ctx, fastify);
fastify.post("/pay", async (_, reply) => reply.send({ ok: true }));
await fastify.listen({ port: 4040 });
```

See root README for full end-to-end run and Express/Next usage.
