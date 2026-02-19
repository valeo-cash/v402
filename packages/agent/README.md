# @v402pay/agent

Unified AI agent payment SDK — v402 payments, spending policy, and MCP integration in one import.

## Install

```bash
npm install @v402pay/agent
```

## Usage

```typescript
import { createAgent, createV402McpServer } from "@v402pay/agent";

const agent = createAgent({
  wallet: myWalletAdapter,
  spendingPolicy: {
    dailyCap: 5.0,
    perCallCap: 0.50,
    allowedTools: ["web_search"],
  },
});

agent.canPay(0.25, "web_search");  // true
agent.remainingBudget();            // 5.0
agent.getStats();                   // { dailySpent, dailyCap, totalPayments, totalSpent }
```

Re-exports everything from `@v402pay/mcp-client` and `@v402pay/mcp-server`.

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)
- [Protocol spec](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
