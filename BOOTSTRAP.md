# Bootstrap and run

## A) Create repo from scratch (if not already created)

```bash
mkdir -p v402 && cd v402
pnpm init
```

Add to `package.json`: `"private": true` and scripts as in the root package.json. Create `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.npmrc`, `.changeset/config.json`. Create all package and app directories and files as in the repo.

## B) Terminal commands to bootstrap and run locally

**If pnpm is not installed:** `npm install -g pnpm`

Run these one at a time (pasting the whole block can trigger zsh parse errors):

```bash
cd v402
```

```bash
pnpm install
```

```bash
pnpm -r build
```

Then:

1. **Supabase**
   ```bash
   cd infra/supabase && supabase start
   supabase db push
   ```
   Copy the printed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` into `.env` at repo root and in `apps/web/.env`.

2. **Env** – In repo root and `apps/web`, set in `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SOLANA_RPC_URL`, `USDC_MINT`, `ENCRYPTION_KEY` (e.g. `openssl rand -hex 32`), and in web `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. **Build**
   ```bash
   pnpm -r build
   ```

4. **Web**
   ```bash
   pnpm --filter web dev
   ```
   Open http://localhost:3000 then Log in (magic link) and open Dashboard.

## C) Publish to npm (changesets)

```bash
pnpm changeset          # add changes (patch/minor/major per package)
pnpm version            # bump versions from changesets
pnpm release            # build and publish (npm login required)
```

Set `NPM_TOKEN` in CI for automated publish.
