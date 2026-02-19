/**
 * v402 MCP Demo Client — calls paid tools with automatic payment and a $1/day cap.
 *
 * Run:  npx tsx client.ts
 */

import { createV402McpClient } from "@v402pay/mcp-client";

async function main() {
  const { Client } = await import(
    "@modelcontextprotocol/sdk/client/index.js"
  );
  const { StdioClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  );

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "server.ts"],
  });
  const mcpClient = new Client({
    name: "v402-demo-client",
    version: "0.3.0",
  });
  await mcpClient.connect(transport);

  const v402 = createV402McpClient({
    wallet: {
      pay: async (params) => {
        console.log(
          `[Mock Pay] ${params.amount} ${params.currency} → ${params.recipient}`,
        );
        return { txSig: `mock-tx-${Date.now()}` };
      },
    },
    policy: { dailyCap: 1.0, perCallCap: 0.01 },
  });

  const tools = await mcpClient.listTools();
  console.log(
    "Available tools:",
    tools.tools.map((t: { name: string }) => t.name),
  );

  console.log("\n--- Calling get_weather ---");
  const weather = await v402.callTool(mcpClient, "get_weather", {
    city: "Tokyo",
  });
  console.log("Paid:", weather.paid);
  console.log("Result:", weather.result.content);

  console.log("\n--- Calling analyze_text ---");
  const analysis = await v402.callTool(mcpClient, "analyze_text", {
    text: "This is a great day for AI agents!",
  });
  console.log("Paid:", analysis.paid);
  console.log("Result:", analysis.result.content);

  console.log("\n--- Budget ---");
  console.log("Remaining:", v402.remainingBudget());
  console.log("History:", v402.getPaymentHistory());

  await mcpClient.close();
}

main().catch(console.error);
