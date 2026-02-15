# Contributing to v402

Thanks for your interest in contributing. This document covers how to set up the repo, open PRs, and report issues.

## Setting up the repo

1. **Fork** the repository on GitHub, then clone your fork (or clone `valeo-cash/v402` if you have push access).

2. **Install dependencies** (Node.js 20+ and [pnpm](https://pnpm.io) required):

   ```bash
   pnpm install
   ```

3. **Build** all packages:

   ```bash
   pnpm -r build
   ```

4. **Run tests**:

   ```bash
   pnpm -r test
   ```

## Monorepo structure

- **packages/core** – Types, canonicalization, hashing, Solana verification, receipt signing
- **packages/sdk** – Client (402 → pay → retry) and wallet adapters (Phantom, Keypair)
- **packages/gateway** – Express/Fastify/Next.js middleware; intent creation, policy enforcement, tx verification, receipt issuance
- **apps/web** – Next.js dashboard (Supabase Auth, tools, receipts, policies, webhooks)

Other folders: `infra/supabase` (migrations), `docs/` (spec and integration examples).

## Pull request process

1. **Branch** from `main` (e.g. `feature/your-feature` or `fix/issue-123`).

2. **Make your changes** and ensure:
   - `pnpm -r build` passes
   - `pnpm -r test` passes

3. **Add a changeset** so the release tooling knows what changed:
   ```bash
   pnpm changeset
   ```
   Follow the prompts to describe the change and choose the version bump type (patch/minor/major) for affected packages.

4. **Open a PR** against `main`. CI will run build and tests. A maintainer will review and merge when ready.

## Reporting issues

- **Bugs and feature requests:** Open a [GitHub issue](https://github.com/valeo-cash/v402/issues). Include steps to reproduce, environment (Node/pnpm versions), and any relevant logs.

- **Security issues:** Do not open a public issue. See [SECURITY.md](SECURITY.md) if present, or contact the maintainers privately.

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers this project.
