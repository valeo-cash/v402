# Solana Agent Kit + v402 Demo

Demonstrates the `@v402pay/solana-agent-kit` plugin with spending controls.

## Setup

```bash
pnpm install
```

## Run

```bash
npx tsx agent.ts
```

The demo creates a v402 plugin with a $5/day spending policy, makes a payment, and shows the budget and history.

## Real Usage

```typescript
import { SolanaAgentKit, createVercelAITools, KeypairWallet } from "solana-agent-kit";
import { createV402Plugin } from "@v402pay/solana-agent-kit";

const agent = new SolanaAgentKit(
  new KeypairWallet(keypair),
  "https://api.devnet.solana.com",
  { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
)
.use(createV402Plugin({
  spendingPolicy: { dailyCap: 10, perCallCap: 1 }
}));

const tools = createVercelAITools(agent, agent.actions);
```
