# @v402pay/crewai

CrewAI integration for v402 — use paid tools in CrewAI agents with automatic payment.

## Install

```bash
npm install @v402pay/crewai @v402pay/agent
```

## Usage

```typescript
import { createAgent } from "@v402pay/agent";
import { V402CrewAITool } from "@v402pay/crewai";

const agent = createAgent({ wallet, spendingPolicy: { dailyCap: 2.0 } });

const tool = new V402CrewAITool({
  agent, mcpClient,
  name: "code_analysis", description: "Analyze code",
  price: "0.05", currency: "USDC", merchant: "MERCHANT_WALLET",
});

const result = await tool._run({ code: "console.log('hello')" }); // payment handled automatically
```

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
