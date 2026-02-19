# @v402pay/mcp-client

MCP client with automatic v402 payment handling and client-side spending policy enforcement.

## Install

```bash
npm install @v402pay/mcp-client
```

## Usage

```typescript
import { createV402McpClient } from "@v402pay/mcp-client";

const client = createV402McpClient({
  wallet: myWalletAdapter,
  policy: { dailyCap: 5.0, perCallCap: 0.50 },
});

const { result, paid, receipt } = await client.callTool(mcpClient, "web_search", { query: "v402" });
// Automatically: detects 402 → checks policy → pays → retries → returns result + receipt
```

## Documentation

- [Full docs](https://github.com/valeo-cash/v402#readme)
- [Protocol spec](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
