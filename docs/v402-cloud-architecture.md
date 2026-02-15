# v402 Cloud — Architecture & Product Plan

**Deliverables index**: A) §2 + §3 — Architecture & integration flow. B) §8 — Implementation plan (2–4 weeks). C) §5 — Pricing. D) §4 — API design + payloads. E) §3 — 5‑minute integration. F) §6 — Security model. G) §7 — Dashboard UX.

---

## 1) Executive Summary

- **v402 Cloud** is hosted infrastructure for the v402 protocol: developers add `V402_API_KEY`, optionally `MERCHANT_WALLET` and `TOOL_ID`, and use `@v402pay/gateway` / `@v402pay/sdk` without running Supabase, migrations, or their own DB.
- **Non-custodial by design**: users pay directly to the merchant’s wallet; v402 Cloud never holds funds. Revenue is SaaS (usage, seats, features), not payment flow.
- **Two modes**: **Cloud Verification** (default)—intents, verification, receipts, and policies live in v402 Cloud; **Hybrid**—gateway verifies tx via RPC locally but still uses Cloud for receipts, policies, and tool registry.
- **One-line integration**: gateway reads `V402_API_KEY` and, if set, talks to v402 Cloud for tool lookup, intent creation, verify, and receipt; same SDK for clients. Optional env: `MERCHANT_WALLET`, `TOOL_ID` for single-tool setups.
- **Ship in 2–4 weeks**: Week 1 API + DB + auth + tool registry; Week 2 intents + verification + receipts; Week 3 dashboard + webhooks + analytics; Week 4 SDK integration + docs + launch. Post-launch: HMAC webhooks, Enterprise SSO, advanced analytics.

---

## 2) Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPER / MERCHANT                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  App Server (Node/Next/Express)          Client (Browser / AI Agent)         │
│  ┌─────────────────────────────┐        ┌─────────────────────────────┐    │
│  │ @v402pay/gateway             │        │ @v402pay/sdk                 │    │
│  │ V402_API_KEY=ck_live_xxx     │        │ (unchanged)                 │    │
│  │ MERCHANT_WALLET=... (opt)    │        │ walletAdapter + fetch()     │    │
│  │ TOOL_ID=... (opt)            │        └──────────────┬──────────────┘    │
│  └──────────────┬──────────────┘                        │                    │
└─────────────────┼───────────────────────────────────────┼────────────────────┘
                  │ HTTPS                                  │ HTTPS (402 → pay → retry)
                  ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: v402 CLOUD API                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ API Gateway │ │ Auth        │ │ Rate Limit  │ │ Logging     │            │
│  │ (Node/Fastify) │ (API Key)  │ │ (Redis)    │ │             │            │
│  └──────┬──────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│         │                                                                   │
│  POST /v1/intents  POST /v1/intents/:id/verify  POST /v1/receipts           │
│  GET/POST /v1/tools  GET/POST /v1/policies  POST /v1/webhooks  GET /v1/...   │
└─────────┼──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   LAYER 2: VERIFICATION WORKERS (optional)                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Verify worker (Node) or inline in API:                              │    │
│  │ • GET tx from Solana RPC                                            │    │
│  │ • Check memo contains v402:<reference>                               │    │
│  │ • Verify recipient + amount (SOL or USDC)                           │    │
│  │ • Derive payer → write paid_verified                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────┼──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 3: DATABASE                                    │
│  Postgres (Supabase or Neon):                                               │
│  merchants | tools | payment_intents | receipts | policies | daily_spend   │
│  webhooks | api_keys | analytics_events                                     │
│  Redis: intent TTL, rate limits, idempotency keys                            │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL: SOLANA (devnet / mainnet)                     │
│  User wallet → tx (memo v402:<ref>, transfer to merchant_wallet)            │
│  v402 Cloud only reads chain; never holds keys or funds.                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3) Integration Flow (Step-by-Step)

### 5-minute developer flow (Cloud mode)

1. **Sign up** at dashboard.v402pay.com → create account → create API key (`ck_live_...` or `ck_test_...`).
2. **Env** (server): `V402_API_KEY=ck_live_xxx`, `V402_CLOUD_URL=https://api.v402pay.com` (default), optional `MERCHANT_WALLET`, `TOOL_ID`.
3. **Server**: Install `@v402pay/gateway`, plug middleware; gateway detects `V402_API_KEY` and uses Cloud backend (tool registry, intents, verify, receipts).
4. **Optional**: Create tool via dashboard (name, path pattern, amount, currency) or via `POST /v1/tools`; if single tool, set `TOOL_ID` so gateway doesn’t need to list tools.
5. **Client**: Unchanged — `@v402pay/sdk` + wallet adapter; first request → 402; pay → retry → 200 + receipt.

### Request flow (Cloud Verification, default)

1. **Client** `fetch(protectedUrl)` → **Gateway** receives request.
2. **Gateway** (with `V402_API_KEY`): normalizes path, calls **v402 Cloud** `POST /v1/intents` with `{ method, path, bodyHash, baseUrl }`. Cloud looks up tool by baseUrl + path, creates intent, returns `{ intentId, amount, currency, recipient, reference, expiresAt, requestHash }`.
3. **Gateway** returns **402** with `Payment-Required`, `V402-Intent-Id`, body = payment intent (same shape as today).
4. **Client (SDK)** parses 402, builds tx (memo `v402:<reference>`), user signs, submits to Solana, then retries request with `V402-Intent-Id`, `V402-Tx-Signature`, `V402-Request-Hash`.
5. **Gateway** receives retry → calls **v402 Cloud** `POST /v1/intents/:id/verify` with `{ txSignature, requestHash }`. Cloud (or inline): fetches tx from RPC, checks memo, recipient, amount, derives payer; writes `paid_verified`, applies policy/daily spend; returns `{ verified: true, payer }` or error.
6. **Gateway** forwards request upstream, gets response; calls **v402 Cloud** `POST /v1/receipts` with response + intent id; Cloud signs receipt, stores it, marks intent consumed; returns receipt payload.
7. **Gateway** returns **200** with upstream body + `V402-Receipt` header.

### Hybrid mode flow

- Steps 1–4 same.
- **Step 5**: Gateway calls Cloud only for intent metadata; verification is done **locally** via existing `verifySolanaPayment` (RPC). Gateway then calls Cloud `POST /v1/intents/:id/verify` with `{ txSignature, requestHash, payer }` to record verified state (Cloud trusts gateway or re-verifies in background).
- **Step 6–7**: Same — receipts and consumption stored in Cloud.

**Default recommendation**: **Cloud Verification** for “one line and done”; Hybrid for high-volume or air-gapped RPC requirements.

---

## 4) API Spec Table

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|--------|
| POST | /v1/merchants | Dashboard / internal | Create merchant (on signup); link API key to merchant. |
| GET | /v1/merchants/me | Bearer API Key | Current merchant profile. |
| POST | /v1/tools | Bearer API Key | Register tool (name, base_url, path_pattern, pricing_model, accepted_currency, merchant_wallet). Returns tool_id. |
| GET | /v1/tools | Bearer API Key | List tools for merchant. |
| GET | /v1/tools/:id | Bearer API Key | Get one tool. |
| PATCH | /v1/tools/:id | Bearer API Key | Update tool (e.g. status, pricing). |
| POST | /v1/intents | Bearer API Key | Create intent. Body: `{ method, path, query?, bodyHash?, contentType?, baseUrl }`. Returns full PaymentIntent. |
| POST | /v1/intents/:id/verify | Bearer API Key | Verify tx. Body: `{ txSignature, requestHash }`. Returns `{ verified, payer? }` or error. |
| POST | /v1/receipts | Bearer API Key | Store receipt after upstream response. Body: `{ intentId, requestHash, txSig, payer, responseStatus, responseHeaders?, responseBody? }`. Returns signed receipt. |
| GET | /v1/receipts | Bearer API Key | List receipts (paginated, filter by tool/date). |
| GET | /v1/receipts/:id | Bearer API Key | Get one receipt. |
| POST | /v1/policies | Bearer API Key | Create/update policy (payer or api_key, max_spend_per_day, etc.). |
| GET | /v1/policies | Bearer API Key | List policies. |
| POST | /v1/webhooks | Bearer API Key | Register webhook URL + events. |
| GET | /v1/webhooks | Bearer API Key | List webhooks. |
| POST | /v1/webhooks/test | Bearer API Key | Send test event. |
| GET | /v1/analytics/calls | Bearer API Key | Aggregates: calls, verified, volume by tool/date. |
| GET | /v1/analytics/usage | Bearer API Key | Usage for billing (calls, receipts, webhooks). |

**Auth**: `Authorization: Bearer ck_live_xxx` or `Bearer ck_test_xxx`. Keys are scoped to a merchant; dashboard uses Supabase Auth + server-side API key for dashboard API.

**Idempotency**: `Idempotency-Key: <uuid>` on POST /v1/intents and POST /v1/receipts; Cloud returns cached response for same key within TTL (e.g. 24h).

### Request/response payloads (key endpoints)

- **POST /v1/intents**  
  Request: `{ method, path, query?: Record<string,string>, bodyHash?: string, contentType?: string, baseUrl }`  
  Response: `{ intentId, toolId, amount, currency, chain, recipient, reference, expiresAt, requestHash }` (PaymentIntent shape).

- **POST /v1/intents/:id/verify**  
  Request: `{ txSignature: string, requestHash: string }`  
  Response: `{ verified: true, payer: string }` or `{ verified: false, error: string }`.

- **POST /v1/receipts**  
  Request: `{ intentId, requestHash, txSig, payer, responseStatus, responseHeaders?: Record<string,string>, responseBody?: string }`  
  Response: `{ receiptId, serverSig, ...receiptPayload }` (signed receipt).

- **POST /v1/tools**  
  Request: `{ name, base_url, path_pattern, pricing_model, accepted_currency, merchant_wallet }`  
  Response: `{ id, tool_id, ...tool }`.

---

## 5) Pricing Table

| Tier | Price | Verified calls/mo | Tools | Webhooks | Receipt retention | Support |
|------|--------|-------------------|-------|----------|-------------------|--------|
| **Free** | $0 | 1,000 | 1 | 0 | 7 days | Community |
| **Pro** | $29/mo base + usage | 10k included, then $0.002/call | 10 | 5 | 90 days | Email |
| **Pro+** | $99/mo base + usage | 50k included, then $0.001/call | 50 | 20 | 1 year | Priority |
| **Enterprise** | Custom | Custom | Unlimited | Unlimited | Custom | Dedicated |

**Usage add-ons (all tiers)**  
- Extra verified call: as above.  
- Extra tool (over limit): $5/tool/mo (Pro), $2/tool/mo (Pro+).  
- Webhook delivery: included up to limit; over limit $0.01/delivery.  
- Analytics retention beyond tier: $10/GB/mo.

**Revenue note**: No fee on payment flow; no custody. Revenue is subscription + usage-based SaaS only.

---

## 6) Security Model

### What the Cloud signs

- **Receipts**: Cloud holds merchant signing key (encrypted) or a Cloud signing key per merchant; receipts are signed by Cloud so clients can verify “v402 Cloud attests this receipt.”
- **Tool metadata**: In Cloud mode, tool metadata is stored and optionally signed by Cloud (or by merchant key stored encrypted); gateway trusts Cloud’s tool registry for “verified tool.”

### What the gateway does

- **Trust**: In Cloud mode, gateway trusts v402 Cloud for intent creation, verification result, and receipt issuance. Gateway does not verify Solana tx itself (unless Hybrid).
- **Signing**: Gateway does not sign receipts in Cloud mode; Cloud does. Gateway only forwards and adds headers.

### What is verified (on-chain)

- **Payment**: Verification worker (or inline) fetches tx via RPC, checks: memo = `v402:<reference>`, recipient = intent.recipient, amount ≥ intent.amount, currency (SOL or USDC). Payer derived from tx only.
- **Replay**: Same (intentId, requestHash, txSig) can only be consumed once; receipt stored with requestHash; duplicate consume returns stored receipt (idempotent).

### Replay protection

- Intent state: `created → paid_verified → consumed`. Only one receipt per (intentId, requestHash).
- Idempotency-Key on POST /v1/intents and POST /v1/receipts; Redis or DB dedupe.

### Tool registry / scam prevention

- Only the merchant that owns the API key can register tools for their `merchant_wallet`. Dashboard and API enforce merchant_id on tools.
- Tool metadata (amount, recipient, path) is stored and returned with intent; client shows “Pay X to Y for Z” — user signs only what’s on chain (memo + transfer). No redirect of funds to Cloud.

### Policies / wallet drain

- Policies (max_spend_per_day, max_per_call, allowlisted tools) enforced in Cloud before returning `verified: true`. Daily spend aggregated in DB; over limit → verify returns 403.

### Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| Cloud issues malicious intent | Intents are created from registered tool (amount, recipient); client displays and user signs; no custody. |
| Replay of same tx | Single consume per (intentId, requestHash); receipt stored. |
| API key leak | Rotate key in dashboard; rate limit + alert on anomaly. |
| Forged receipt | Receipts signed by Cloud (or merchant); client verifies signature. |
| Policy bypass | Policy checked server-side before marking paid_verified and before issuing receipt. |

---

## 7) Product UI Plan (Dashboard)

- **Login**: Supabase Auth (magic link or email/password).
- **Home**: Overview — active tools, calls today, revenue (merchant-side), link to docs.
- **API Keys**: List keys, create (test/live), revoke; show last used (optional).
- **Tools**: Table of tools; Create tool (name, base URL, path pattern, pricing model, currency, merchant wallet); Edit / disable.
- **Pricing config**: Per-tool pricing (already in tool); optional “default pricing” for new tools.
- **Webhooks**: List endpoints; Add (URL, events: receipt.created, etc.); Test; logs (delivery status, retries).
- **Receipts**: List receipts (filter by tool, date, payer); detail view (receipt payload, signature, tx link).
- **Policies**: List policies (by payer or API key); Create/edit (max spend/day, max/call, allowlists).
- **Analytics**: Charts — calls over time, verified vs 402, volume (SOL/USDC); breakdown by tool; export CSV.
- **Billing**: Current plan, usage this period, upgrade/change plan (Stripe Customer Portal or custom).

---

## 8) Implementation Plan (2–4 Weeks)

### Week 1: API + DB + Auth + Tool registry

- **DB**: Postgres schema (merchants, api_keys, tools, payment_intents, receipts, policies, daily_spend, webhooks, analytics_events). Reuse v402 schema where possible; add `api_keys` and `merchant_id` on all tenant tables.
- **Auth**: API key creation + validation middleware (Bearer); associate key to merchant (create merchant on first key or on signup).
- **API**: Node (Fastify) service; POST/GET /v1/tools, GET /v1/merchants/me; deploy behind existing domain or api.v402pay.com.
- **Dashboard**: Supabase Auth; dashboard app (Next.js) with login; API Keys page (create/list/revoke); Tools page (create/list). Dashboard calls its own backend with session or server-side API key.

**Exit criteria**: Create API key in dashboard; create tool via API with key; list tools.

### Week 2: Intents + Verification + Receipts

- **Intents**: POST /v1/intents (lookup tool by baseUrl + path, create intent row, return PaymentIntent). Redis: intent TTL (e.g. 15 min) and optional idempotency.
- **Verify**: POST /v1/intents/:id/verify: fetch tx from RPC (configurable Solana RPC), verify memo/recipient/amount, derive payer; update intent to paid_verified; apply policy + daily spend; return { verified, payer }.
- **Receipts**: POST /v1/receipts: sign receipt (Cloud key or merchant key), store, mark intent consumed; return receipt. GET /v1/receipts (list).
- **Gateway**: Update `@v402pay/gateway` to detect `V402_API_KEY` + `V402_CLOUD_URL`; in Cloud mode, call Cloud for create intent, verify, and issue receipt; keep same 402/200 behavior and headers for SDK.

**Exit criteria**: End-to-end flow: gateway → 402 → client pays → verify → 200 + receipt; receipts queryable.

### Week 3: Dashboard + Webhooks + Analytics

- **Dashboard**: Webhooks (CRUD, test), Receipts list/detail, Policies CRUD, Analytics (calls, verified, volume by day/tool). Use existing design system if any.
- **Webhooks**: On receipt creation, enqueue delivery (in-process or queue); POST to customer URL with signed payload; retry with backoff; store delivery logs.
- **Analytics**: Emit events (intent_created, intent_verified, receipt_created); aggregate in DB or warehouse; GET /v1/analytics/calls and /usage.

**Exit criteria**: Dashboard usable for tools, webhooks, receipts, policies, analytics; webhook test succeeds.

### Week 4: Docs + SDK integration + Launch

- **Docs**: “Integrate in 5 minutes” — env vars, gateway snippet, optional dashboard steps; API reference (OpenAPI or Markdown); migration from self-hosted (optional).
- **SDK**: Gateway release that supports Cloud by default when `V402_API_KEY` set; changelog and upgrade guide.
- **Launch**: Soft launch (invite-only or public); monitor errors and latency; stripe billing integration for Pro/Pro+ (optional for week 4 or follow-up).

### Postpone (post-MVP)

- HMAC-signed webhook verification (document secret; HMAC in header).
- Enterprise: SSO, custom contracts, SLA.
- Hybrid mode in gateway (can be week 2 if simple: gateway verifies locally, then POST verify with payer).
- Advanced analytics (funnels, cohorts).

---

## 9) Default Mode and Env Summary

- **Default**: Cloud Verification (intent + verify + receipt in v402 Cloud).
- **Env (gateway)**: `V402_API_KEY` (required for Cloud), `V402_CLOUD_URL` (default https://api.v402pay.com), optional `MERCHANT_WALLET`, `TOOL_ID` for single-tool “one line” setup.
- **Env (client)**: Unchanged; SDK only needs wallet and RPC for signing and submitting tx.

This document is the single source of truth for v402 Cloud architecture, API, pricing, security, dashboard, and 2–4 week implementation plan.
