# @v402pay/mcp-server

MCP server with v402 payment-gated tools for AI agents.

## Install

```bash
npm install @v402pay/mcp-server
```

## Usage

```typescript
import { createV402McpServer } from "@v402pay/mcp-server";

const server = createV402McpServer({
  tools: [{
    name: "web_search",
    description: "Search the web",
    inputSchema: { query: { type: "string" } },
    price: "0.01",
    currency: "USDC",
    merchant: "MERCHANT_WALLET",
    handler: async (args) => ({ results: ["..."] }),
  }],
  testMode: true,
});
```

Tools are automatically gated: unpaid calls return `payment_required`, paid calls execute the handler and return a v402 receipt.

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)
- [Protocol spec](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
