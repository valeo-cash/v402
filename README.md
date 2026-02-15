# v402pay

**v402pay** is a non-custodial payments and execution protocol for AI agents on Solana. It uses HTTP 402 to request payment; settlement is real (USDC SPL or SOL) and verified on-chain.

- **Non-custodial**: The server never stores or uses user private keys.
- **Real**: No mocks; persisted DB, real payment verification, tool registry, policies, receipts.
- **NPM packages**: `@v402pay/core`, `@v402pay/sdk`, `@v402pay/gateway`.

## Repo structure

- `packages/core` – Types, canonicalization, hashing, Solana verification, receipt signing
- `packages/sdk` – Client (402 → pay → retry) and wallet adapters (Phantom, Keypair)
- `packages/gateway` – Express/Fastify/Next.js middleware; intent creation, policy enforcement, tx verification, receipt issuance
- `apps/web` – Next.js dashboard (Supabase Auth, tools, receipts, policies, webhooks)
- `infra/supabase/migrations` – Schema and RLS
- `docs/spec.md` – Protocol spec; `docs/integrations/` – integration examples

## How to run locally

**Prerequisites:** Node.js 20+ and pnpm. If pnpm is not installed:

```bash
npm install -g pnpm
```

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

## Plug-and-play (zero friction)

**One-time setup:** Start Supabase and apply migrations, then set `.env` at repo root (see above).

```bash
cd infra/supabase && supabase start
supabase db push
# Copy .env.example to .env and set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY (32-byte hex), SOLANA_RPC_URL, USDC_MINT
```

**One command to run the merchant server** (seeds a demo user + tool, then starts the server; no web UI):

```bash
pnpm install && pnpm -r build
pnpm play
```

**Call it from anywhere** (no repo, no script — just npx):

```bash
npx @v402pay/sdk http://localhost:4040/pay
```

First call returns 402; the CLI uses a new Keypair with no SOL by default. To get 200, airdrop to that keypair on devnet or use your own keypair in code (see SDK README).

## End-to-end real run (no demos)

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

**3. Start a real merchant tool server** (in another terminal)

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
