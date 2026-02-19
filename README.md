# v402 — The Payment Protocol for Autonomous AI Agents

[![CI](https://github.com/valeo-cash/v402/actions/workflows/ci.yml/badge.svg)](https://github.com/valeo-cash/v402/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@v402pay/core)](https://www.npmjs.com/package/@v402pay/core)
[![npm](https://img.shields.io/npm/v/@v402pay/sdk)](https://www.npmjs.com/package/@v402pay/sdk)
[![npm](https://img.shields.io/npm/v/@v402pay/gateway)](https://www.npmjs.com/package/@v402pay/gateway)

> Non-custodial. Policy-enforced. No facilitator. Solana-native.

## Why v402

**x402 lets agents pay. v402 lets agents pay _safely_.**

When AI agents spend money autonomously, you need more than a payment rail — you need spending controls, per-tool budgets, signed receipts, and direct on-chain verification with no middleman holding funds. v402 is the protocol that makes autonomous agent payments safe by default.

## The v402 difference

| Feature | x402 | v402 |
|---|---|---|
| **Facilitator** | Required (Coinbase) | None — direct on-chain verification |
| **Spending controls** | None | Built-in: daily caps, per-call limits, tool/merchant allowlists |
| **Signed receipts** | No | Ed25519 signed, verifiable receipts |
| **Tool-aware intents** | No | Yes — intents scoped to tool, session billing |
| **Session billing** | No | Yes — one payment covers N calls |
| **Chain** | Base (EVM) | Solana (USDC / SOL) |
| **Custody** | Semi-custodial | Non-custodial — server never touches user keys |
| **MCP integration** | No | Native MCP server & client packages |

## Quick start — 60 seconds

```typescript
import { createAgent, createV402McpServer } from "@v402pay/agent";

// Agent side — autonomous payments with safety rails
const agent = createAgent({
  wallet: myWalletAdapter,
  spendingPolicy: {
    dailyCap: 5.0,          // $5/day max
    perCallCap: 0.50,       // 50¢ per tool call
    allowedTools: ["web_search", "code_analysis"],
  },
});

// Check before paying
agent.canPay(0.25, "web_search");   // true
agent.remainingBudget();             // 5.0

// Server side — paid MCP tools
const server = createV402McpServer({
  tools: [
    {
      name: "web_search",
      description: "Search the web",
      inputSchema: { query: { type: "string" } },
      price: "0.01",
      currency: "USDC",
      merchant: "MERCHANT_WALLET",
      handler: async (args) => ({ results: ["..."] }),
    },
  ],
  testMode: true,
});
```

## Architecture

```
Agent                           Gateway                        Tool Server
  │                               │                               │
  │─── GET /tool ────────────────>│                               │
  │<── 402 + Payment Intent ──────│                               │
  │                               │                               │
  │─── Pay on-chain (Solana) ─────│                               │
  │                               │                               │
  │─── Retry + tx proof ─────────>│                               │
  │                               │── Verify on-chain (no facilitator)
  │                               │── Check spending policy       │
  │                               │── Forward ───────────────────>│
  │                               │<── Tool result ───────────────│
  │<── 200 + Signed Receipt ──────│                               │
```

No facilitator. No custodial keys. The gateway verifies the Solana transaction directly, checks the agent's spending policy, then forwards to the tool.

## Packages

| Package | Description |
|---|---|
| [`@v402pay/core`](packages/core) | Types, canonicalization, hashing, Solana verification, receipt signing |
| [`@v402pay/sdk`](packages/sdk) | Client: 402 → pay → retry flow, wallet adapters (Phantom, Keypair) |
| [`@v402pay/gateway`](packages/gateway) | Server middleware (Express/Fastify/Next.js): intents, policy, tx verification, receipts |
| [`@v402pay/agent`](packages/agent) | **Unified agent SDK** — payments + spending policy + MCP in one import |
| [`@v402pay/mcp-server`](packages/mcp-server) | MCP server with v402 payment-gated tools |
| [`@v402pay/mcp-client`](packages/mcp-client) | MCP client with automatic payment and policy enforcement |
| [`@v402pay/langchain`](packages/integrations/langchain) | LangChain integration — v402 paid tools as LangChain StructuredTools |
| [`@v402pay/crewai`](packages/integrations/crewai) | CrewAI integration — v402 paid tools for CrewAI agents |
| [`@v402pay/solana-agent-kit`](packages/integrations/solana-agent-kit) | Solana Agent Kit v2 plugin — spending controls for SAK agents |
| [`apps/web`](apps/web) | Next.js dashboard (Supabase Auth, tool registry, receipts, policies) |

## Framework integrations

### LangChain

```typescript
import { createAgent } from "@v402pay/agent";
import { V402LangChainTool } from "@v402pay/langchain";

const agent = createAgent({ wallet, spendingPolicy: { dailyCap: 2.0 } });

const searchTool = new V402LangChainTool({
  agent,
  mcpClient,
  name: "web_search",
  description: "Search the web",
  price: "0.01",
  currency: "USDC",
  merchant: "MERCHANT_WALLET",
});

// Use with any LangChain agent — payment happens automatically
```

### CrewAI

```typescript
import { createAgent } from "@v402pay/agent";
import { V402CrewAITool } from "@v402pay/crewai";

const agent = createAgent({ wallet, spendingPolicy: { dailyCap: 2.0 } });

const tool = new V402CrewAITool({
  agent,
  mcpClient,
  name: "code_analysis",
  description: "Analyze code",
  price: "0.05",
  currency: "USDC",
  merchant: "MERCHANT_WALLET",
});
```

## Getting started

**Prerequisites:** Node.js 20+ and pnpm (`npm install -g pnpm`).

### Cloud mode (recommended)

Set `V402_API_KEY` and optionally `V402_CLOUD_URL`. No database required — intents, verification, and receipts are handled by v402 Cloud.

### Self-hosted

Full control with your own Supabase instance:

```bash
cd infra/supabase && supabase start && supabase db push
pnpm install && pnpm -r build
pnpm --filter web dev
```

### Try locally

```bash
pnpm play                                          # Start seeded merchant server
npx @v402pay/sdk http://localhost:4040/pay          # Call the paid endpoint
```

<details>
<summary><strong>Environment variables</strong></summary>

| Variable | Required | Description |
|---|---|---|
| `V402_API_KEY` | Cloud | v402 Cloud API key |
| `SUPABASE_URL` | Self-hosted | Supabase project URL |
| `SUPABASE_ANON_KEY` | Self-hosted | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Self-hosted | Supabase service role key |
| `SOLANA_RPC_URL` | Self-hosted | Solana RPC endpoint |
| `USDC_MINT` | Self-hosted | USDC SPL token mint address |
| `ENCRYPTION_KEY` | Self-hosted | 32-byte hex key for merchant key encryption |

</details>

## Documentation

- [Protocol spec v1](docs/spec.md)
- [Protocol spec v2 — tool-aware intents](docs/spec-v2.md)
- [MCP demo](examples/mcp-demo/)
- [Integration examples](docs/integrations/)

## Publishing

```bash
# Build and test
pnpm -r build && pnpm test && pnpm -r lint

# Publish (in dependency order)
cd packages/core && npm publish --access public
cd ../sdk && npm publish --access public
cd ../gateway && npm publish --access public
cd ../mcp-server && npm publish --access public
cd ../mcp-client && npm publish --access public
cd ../agent && npm publish --access public
cd ../integrations/langchain && npm publish --access public
cd ../integrations/crewai && npm publish --access public
cd ../integrations/solana-agent-kit && npm publish --access public

# Tag and push
git add -A && git commit -m "v0.3.0: tool-aware intents, MCP integration, agent SDK"
git tag v0.3.0 && git push && git push --tags
```

## License

[MIT](LICENSE)
