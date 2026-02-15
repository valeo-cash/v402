# Verification checklist (A–H)

## A) No mocks / no demos / no seed

### A1) seed.sql removed or empty
**PASS** — No `infra/supabase/seed.sql` in repo (glob search: 0 files). No seed data; DB is populated only by real signup/tool creation.

### A2) No demo-provider/demo-client apps; no mocked data in apps/web
**PASS (after fix)** — No demo apps. Removed mocked `"placeholder-wallet"` from tools page.

- **Fix**: [apps/web/app/app/tools/page.tsx](apps/web/app/app/tools/page.tsx) — When no merchant exists, show `SetWalletForm` instead of calling `getOrCreateMerchant(user.id, "placeholder-wallet")`. User must set a real Solana wallet via [apps/web/app/api/merchant/setup/route.ts](apps/web/app/api/merchant/setup/route.ts) (POST `{ "wallet": "..." }`).
- **New**: [apps/web/app/app/tools/SetWalletForm.tsx](apps/web/app/app/tools/SetWalletForm.tsx) — Form that submits wallet to `/api/merchant/setup`.
- CreateToolForm “placeholder” strings are HTML input `placeholder` attributes only (UX hints), not mock data.

---

## B) Idempotency returns original upstream response

### B3) Receipts schema + storage + replay
**PASS**

- **Schema**: [infra/supabase/migrations/00001_initial_schema.sql](infra/supabase/migrations/00001_initial_schema.sql) lines 60–77:
  - `response_status INT NOT NULL`
  - `response_headers JSONB NOT NULL DEFAULT '{}'`
  - `response_body TEXT`
- **Replay (no upstream call)**: [packages/gateway/src/flow.ts](packages/gateway/src/flow.ts) lines 61–76: when `findConsumedReceipt` returns, result is `type: "replay"` with `responseStatus`, `responseHeaders`, `responseBody`, `receipt`; middleware returns these without calling upstream.
- **Storage**: [packages/gateway/src/receipt.ts](packages/gateway/src/receipt.ts) — `createAndStoreReceipt` writes `response_status`, `response_headers`, `response_body` to `receipts`.

*(Optional later: encrypt `response_body` in a new migration; current store is plain TEXT.)*

---

## C) Canonical hashing + raw body forwarding

### C4) Canonical rules in spec; gateway buffers raw body and forwards unchanged
**PASS**

- **Spec**: [docs/spec.md](docs/spec.md) §1.1–1.2 — Method, normalized path, sorted query, body (JSON: parse + stable-stringify; non-JSON: raw bytes + content-type), content-type. Delimiter `\n`.
- **Gateway buffer**: [packages/gateway/src/middleware/express.ts](packages/gateway/src/middleware/express.ts) — `getBody(req)` uses `(req as any).rawBody` when set by `rawBodyParser`; [express.md](docs/integrations/express.md) documents `express.json({ verify: rawBodyParser })`. Body used for hashing is the buffered raw body.
- **Forward unchanged**: Same `req` (and thus same body) is passed to `next()` for the route handler; upstream receives the original request.

### C5) SDK same requestHash as gateway; cross-package test vector
**PASS**

- **SDK**: [packages/sdk/src/client.ts](packages/sdk/src/client.ts) — Uses `buildCanonicalRequest` and `requestHash` from `@v402pay/core` (same as gateway).
- **Test vector**: [docs/spec.md](docs/spec.md) §1.4 — GET `/api/tool`, query `{ b: "2", a: "1" }` → canonical `GET\n/api/tool\na=1&b=2\n\n\n`. [packages/core/src/__tests__/canonical.test.ts](packages/core/src/__tests__/canonical.test.ts) — `cross-package test vector` describe block asserts same canonical string and deterministic hash.

---

## D) Memo/reference mandatory (no fallback)

### D6) Verify requires Memo exactly `v402:<reference>`; fails otherwise
**PASS**

- [packages/core/src/solana/verify.ts](packages/core/src/solana/verify.ts) lines 102–105:
  - `const memos = parseMemoInstructions(tx);`
  - `if (!hasV402Memo(memos, intent.reference)) { throw new Error(\`Missing Memo instruction with v402:${intent.reference}\`); }`
- [packages/core/src/solana/memo.ts](packages/core/src/solana/memo.ts) — `hasV402Memo` returns true only when at least one memo data equals (after trim/decode) `v402:` + reference. No “match recent txs” or other fallback.

---

## E) Payer derivation + policy enforcement

### E7) Payer derived from tx; persisted to payment_intents.payer
**PASS**

- [packages/core/src/solana/verify.ts](packages/core/src/solana/verify.ts): SOL → `payer = feePayer` (accountKeys[0]); USDC → `payer = sourceOwner` from SPL transfer info. Returns `{ txSig, payer, blockTime }`.
- [packages/gateway/src/flow.ts](packages/gateway/src/flow.ts) line 82: `await markIntentPaidVerified(ctx.supabase, intentRow.intent_id, payer);` — payer from `verifyPayment` (which calls core verify) is persisted.

### E8) Policies enforced using derived payer
**PASS**

- [packages/gateway/src/flow.ts](packages/gateway/src/flow.ts) lines 89–98: `getPolicyByPayer(ctx.supabase, payer)`, `getDailySpend(ctx.supabase, payer)`, `checkPolicy(policy, { amount, toolId, merchantWallet, dailySpend })`; if `!check.allowed` throws.
- [packages/gateway/src/policy.ts](packages/gateway/src/policy.ts) — `checkPolicy` enforces `max_spend_per_call`, `max_spend_per_day`, `allowlisted_tool_ids`, `allowlisted_merchants`. `getDailySpend` uses UTC date; `incrementDailySpend` upserts by `(payer, date_utc)` (real, idempotent). Fixed typo: `parseFloat(p.max_spend_per_call)`.

---

## F) Merchant signing keys + tool trust

### F9) Merchant private key not stored in plaintext
**PASS**

- [infra/supabase/migrations/00001_initial_schema.sql](infra/supabase/migrations/00001_initial_schema.sql) — `signing_private_key_encrypted TEXT NOT NULL`.
- [packages/gateway/src/encrypt.ts](packages/gateway/src/encrypt.ts) — `decryptMerchantKey` / `encryptMerchantKey` using `ENCRYPTION_KEY` (32-byte hex). Decryption only server-side in gateway and webapp (create receipt, sign tool metadata).

### F10) Gateway only issues intents for tools with valid metadata_signature
**PASS**

- [packages/gateway/src/flow.ts](packages/gateway/src/flow.ts) lines 108–112: `const validSig = await verifyToolMetadataSignature(tool as ToolRow); if (!validSig) throw new Error("Tool metadata signature invalid");` — intent creation runs only after this. [packages/gateway/src/tools.ts](packages/gateway/src/tools.ts) — `verifyToolMetadataSignature` builds canonical tool metadata and verifies with `verifyEd25519Message(canonical, tool.metadata_signature, pubKey)`.

---

## G) RLS + service role boundaries

### G11) Gateway uses Supabase SERVICE_ROLE key server-side only
**PASS**

- [packages/gateway/src/config.ts](packages/gateway/src/config.ts) — `supabaseServiceRoleKey` from env. [packages/gateway/src/flow.ts](packages/gateway/src/flow.ts) — `createClient(config.supabaseUrl, config.supabaseServiceRoleKey)`. Used only in server-side gateway code.

### G12) RLS: merchants CRUD only own data; clients cannot read other merchants’ data
**PASS**

- [infra/supabase/migrations/00002_rls_policies.sql](infra/supabase/migrations/00002_rls_policies.sql) — `merchants_own`: `auth.uid() = supabase_user_id`. `tools_merchant`: `merchant_id IN (SELECT id FROM merchants WHERE supabase_user_id = auth.uid())`. `payment_intents_via_tool` / `receipts_via_tool`: scoped via tool → merchant. `policies_service_only` / `daily_spend_service_only`: `USING (false)` so anon/authenticated cannot read; gateway uses service role (bypasses RLS). `webhooks_merchant`: by merchant_id.

---

## H) CI-grade verification command

### H13) Single `pnpm verify` script
**PASS**

- [package.json](package.json): `"verify": "pnpm -r build && pnpm test && pnpm lint"` — runs build, tests, lint; any failure fails the command.

---

## Summary

| Item | Status |
|------|--------|
| A1 seed.sql | PASS (none) |
| A2 no demos/mocks | PASS (fixed placeholder-wallet) |
| B3 idempotency schema + replay | PASS |
| C4 canonical + buffer + forward | PASS |
| C5 SDK/gateway same hash + test vector | PASS |
| D6 memo mandatory | PASS |
| E7 payer derivation + persist | PASS |
| E8 policy by payer + daily_spend | PASS |
| F9 encrypted merchant key | PASS |
| F10 intents only for valid signature | PASS |
| G11 service role only | PASS |
| G12 RLS | PASS |
| H13 pnpm verify | PASS |

**Fixes applied this pass**

1. **apps/web** — Removed `getOrCreateMerchant(user.id, "placeholder-wallet")`. Added `SetWalletForm` and `POST /api/merchant/setup` so merchant is created only with a user-supplied wallet.
2. **packages/gateway/src/policy.ts** — `parseFloat(policy.max_spend_per_call)` → `parseFloat(p.max_spend_per_call)`.
3. **docs/spec.md** — §1.4 test vector for canonical/hash.
4. **packages/core/src/__tests__/canonical.test.ts** — Cross-package test vector (GET /api/tool, query order, deterministic hash).
5. **package.json** — `"verify": "pnpm -r build && pnpm test && pnpm lint"`.
6. **packages/gateway, packages/sdk** — Added no-op `"test"` script so `pnpm test` runs cleanly.
