# v402 MCP Demo

Two payment-gated tools served over MCP with automatic v402 payment handling.

## Tools

| Tool | Price | Description |
|---|---|---|
| `get_weather` | 0.001 USDC | Get weather for a city |
| `analyze_text` | 0.005 USDC | Analyze text for word count and sentiment |

## Running

```bash
# From the monorepo root
pnpm install
pnpm -r build

# Start the server on stdio
cd examples/mcp-demo
npx tsx server.ts

# Or run the client (spawns the server automatically)
npx tsx client.ts
```

The demo runs in **testMode** — no real Solana transactions. The mock wallet
logs payment details to the console.

## How it works

1. The **server** wraps each tool with `createV402McpServer`. When a tool is
   called without `_v402_payment`, the server returns a `payment_required`
   response containing the v402 intent (amount, currency, merchant, intent_id).

2. The **client** uses `createV402McpClient` with a spending policy ($1/day,
   $0.01/call). When it receives `payment_required`, it:
   - Checks the spending policy
   - Pays via the wallet adapter (mock in this demo)
   - Retries the tool call with the payment proof
   - Tracks daily spending

3. The server verifies the payment proof, executes the tool handler, and
   returns the result along with a v402 receipt.
