# v402

[![CI](https://github.com/valeo-cash/v402/actions/workflows/ci.yml/badge.svg)](https://github.com/valeo-cash/v402/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@v402pay/core)](https://www.npmjs.com/package/@v402pay/core)

**v402** is a non-custodial payment protocol for AI agents and APIs on Solana. Servers return HTTP 402; clients pay with USDC or SOL from their wallet, then retry with proof. Settlement is verified on-chain. No mocks, no custodial keys—real payments and signed receipts.

**Why v402 over x402:** Capability-based permissions (each intent scoped to one request), replay-safe receipts, and proof-of-execution so the server knows payment landed before running the tool. Stays non-custodial: the server never touches user keys.

**Integrate in under a minute:** Install the gateway and SDK, mount the middleware on your server, and use the client to call your paid endpoint. First request returns 402 with payment details; after the client pays and retries, you get 200 and a signed receipt.

```javascript
// Server (e.g. Fastify)
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";
const ctx = createGatewayContext(process.env);
await v402GatewayFastify(ctx, fastify);
fastify.post("/pay", async (_, reply) => reply.send({ ok: true }));

// Client
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
const { fetch } = createV402Client({ walletAdapter: createKeypairAdapter({ keypair, rpcUrl }) });
const res = await fetch("https://your-api.com/pay", { method: "POST", body: JSON.stringify({}) });
// 402 → pay → retry → 200 with V402-Receipt
```

## Conceptual flow

1. **402 + intent** – Server returns 402 with payment intent (amount, recipient, reference).
2. **Pay from wallet** – Client signs and sends USDC/SOL on Solana with a memo binding the payment to the intent.
3. **Retry with proof** – Client retries the request with payment proof (e.g. signature or tx reference).
4. **Verify on-chain** – Gateway (or v402 Cloud) verifies the transaction and memo on Solana.
5. **Execute + signed receipt** – Server runs the tool and returns 200 with a signed `V402-Receipt` header.

## Repo structure

- `packages/core` – Types, canonicalization, hashing, Solana verification, receipt signing
- `packages/sdk` – Client (402 → pay → retry) and wallet adapters (Phantom, Keypair)
- `packages/gateway` – Express/Fastify/Next.js middleware; intent creation, policy enforcement, tx verification, receipt issuance
- `apps/web` – Next.js dashboard (Supabase Auth, tools, receipts, policies, webhooks)
- `infra/supabase/migrations` – Schema and RLS
- `docs/spec.md` – Protocol spec; `docs/integrations/` – integration examples

## Getting started

**Prerequisites:** Node.js 20+ and pnpm. If pnpm is not installed: `npm install -g pnpm`.

### Cloud mode (recommended)

Set `V402_API_KEY` and optionally `V402_CLOUD_URL` (default: `https://api.v402pay.com`). No Supabase or database to run. Register your tool in the v402 Cloud dashboard, then run your server with the gateway; it will use Cloud for intents, verification, and receipts.

```bash
# .env
V402_API_KEY=ck_live_xxx
# optional: V402_CLOUD_URL, MERCHANT_WALLET, TOOL_ID
```

Build and run your gateway as in the 60-second snippet above. Clients use `@v402pay/sdk` against your paid URL.

### Self-hosted (local bootstrap)

Full control: you run Supabase, the web dashboard, and your own tool registry. Requires Supabase and env setup.

1. **Supabase**

   ```bash
   cd infra/supabase && supabase start
   supabase db push
   ```

   Copy the local `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` into `.env` at repo root and in `apps/web`.

2. **Env** – In repo root and `apps/web`, create `.env` from `.env.example` and set the variables listed there (Supabase, Solana RPC, USDC mint, encryption key, and for web the `NEXT_PUBLIC_*` vars).

3. **Build**

   ```bash
   pnpm install
   pnpm -r build
   ```

4. **Web app**

   ```bash
   pnpm --filter web dev
   ```

   Open http://localhost:3000, then **Log in** (magic link) and **Dashboard**.

Set `.env` in repo root and in `apps/web`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SOLANA_RPC_URL`, `USDC_MINT`, `ENCRYPTION_KEY` (32-byte hex), and in web `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Local bootstrap (one-command server)

After Supabase and env are set (see above), you can run a minimal merchant server that seeds a local user and tool, then starts the server (no web UI):

```bash
pnpm install && pnpm -r build
pnpm play
```

**Call it from anywhere** (no repo, no script — just npx):

```bash
npx @v402pay/sdk http://localhost:4040/pay
```

First call returns 402; the CLI uses a new Keypair with no SOL by default. To get 200, airdrop to that keypair on devnet or use your own keypair in code (see SDK README).

## End-to-end self-hosted run

After Supabase and env are set (see above), run in order:

**1. Start Supabase and apply migrations**

```bash
cd infra/supabase && supabase start
supabase db push
```

**2. Start the web app** (in another terminal)

```bash
pnpm --filter web dev
```

Log in at http://localhost:3000 (magic link), set your Solana receiver wallet on the Tools page, then create one tool (name, base URL e.g. `http://localhost:4040`, path pattern e.g. `/pay`, per-call amount, merchant wallet). Leave the web app running.

**3. Start a merchant tool server** (in another terminal)

Copy-paste the following into `merchant-server.mjs` at repo root (or use the existing file), then run `node merchant-server.mjs`. Requires env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SOLANA_RPC_URL`, `USDC_MINT`, `ENCRYPTION_KEY`.

```javascript
import Fastify from "fastify";
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";

const ctx = createGatewayContext(process.env);
const fastify = Fastify({ logger: true });
await v402GatewayFastify(ctx, fastify);
fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  req.rawBody = body;
  done(null, body);
});
fastify.post("/pay", async (request, reply) => {
  return reply.send({ ok: true, ts: new Date().toISOString() });
});
await fastify.listen({ port: 4040, host: "0.0.0.0" });
console.log("Merchant server on http://localhost:4040");
```

**4. Call the protected endpoint with the SDK**

From the same repo (with the tool’s base URL `http://localhost:4040` and path `/pay` registered in the web app), use the SDK. Example (Node, dev only — Keypair adapter): save as `call-with-sdk.mjs` at repo root (or use the existing file), then run `node call-with-sdk.mjs`. Set `SOLANA_RPC_URL` (devnet or mainnet) and ensure the keypair has funds.

```javascript
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();
const adapter = createKeypairAdapter({
  keypair,
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
});
const { fetch } = createV402Client({ walletAdapter: adapter });
const res = await fetch("http://localhost:4040/pay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
console.log(res.status, await res.json());
```

First call returns 402 with an intent; after the client pays and retries, the second response is 200 with the upstream body and a `V402-Receipt` header.

Integration examples (Express, SDK) are in `docs/integrations/`.

## Publish to npm

Packages (public): `@v402pay/core`, `@v402pay/sdk`, `@v402pay/gateway`. Changesets are configured with `access: "public"`.

From the repo root. If pnpm is not installed, run `npm install -g pnpm` first. Then run (one command per line, no comments in the block):

```bash
pnpm install
pnpm verify
pnpm changeset
pnpm version
pnpm release
```

Ensure you are logged in (`npm login`) and have publish rights. For CI, set `NPM_TOKEN`. Publish runs `changeset publish` with `--access public`.

**Versioning:** With one patch changeset, `pnpm version` bumps to 0.1.1; with no changesets, versions stay 0.1.0.

**Verifying publish:** Don’t rely on `npm view ... access` alone. Confirm instead: (1) each package’s npmjs.com page loads and shows **Public**, (2) `npm install @v402pay/core` (and sdk/gateway) works from a clean shell, (3) `npm view @v402pay/core` shows the published version and dist-tags.
