# @v402pay/langchain

LangChain integration for v402 — use paid tools as LangChain StructuredTools with automatic payment.

## Install

```bash
npm install @v402pay/langchain @v402pay/agent
```

## Usage

```typescript
import { createAgent } from "@v402pay/agent";
import { V402LangChainTool } from "@v402pay/langchain";

const agent = createAgent({ wallet, spendingPolicy: { dailyCap: 2.0 } });

const tool = new V402LangChainTool({
  agent, mcpClient,
  name: "web_search", description: "Search the web",
  price: "0.01", currency: "USDC", merchant: "MERCHANT_WALLET",
});

const result = await tool._call({ query: "v402" }); // payment handled automatically
```

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
