# @v402pay/solana-agent-kit

Solana Agent Kit v2 plugin for v402 agent payments with built-in spending controls.

## Install

```bash
npm install @v402pay/solana-agent-kit
```

## Quick Start

```typescript
import { SolanaAgentKit, createVercelAITools, KeypairWallet } from "solana-agent-kit";
import { createV402Plugin } from "@v402pay/solana-agent-kit";

const agent = new SolanaAgentKit(
  new KeypairWallet(keypair),
  "https://api.devnet.solana.com",
  { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
)
.use(createV402Plugin({
  spendingPolicy: {
    dailyCap: 10,
    perCallCap: 1,
    allowedTools: ["web_search"],
  }
}));

const tools = createVercelAITools(agent, agent.actions);
```

## Actions

| Action | Description |
|---|---|
| `V402_PAY_FOR_TOOL` | Pay for a tool — checks policy, records payment |
| `V402_CHECK_SPENDING_BUDGET` | Check daily cap, spent, remaining budget |
| `V402_GET_PAYMENT_HISTORY` | Get all payments in this session |
| `V402_VERIFY_RECEIPT` | Verify an Ed25519-signed v402 receipt |

## Why v402?

| Without v402 | With v402 |
|---|---|
| No spending limits | Daily caps, per-call limits |
| Agent can pay anyone | Tool and merchant allowlists |
| Trust the API response | On-chain verification, no facilitator |
| Transaction logs only | Ed25519 signed portable receipts |

## Documentation

- [v402 Protocol](https://github.com/valeo-cash/v402)
- [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
