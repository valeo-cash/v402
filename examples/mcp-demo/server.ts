/**
 * v402 MCP Demo Server — two paid tools behind v402 payment gating.
 *
 * Run:  npx tsx server.ts
 */

import { createV402McpServer } from "@v402pay/mcp-server";

async function main() {
  const { server } = await createV402McpServer({
    tools: [
      {
        name: "get_weather",
        description: "Get current weather for a city",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
        price: "0.001",
        currency: "USDC",
        merchant: "7nYRmhGKdR4mCfJLfQbAaZ9sGkS3vZoNM3y8EqMkbK8k",
        handler: async (args) => ({
          city: args.city,
          temperature: Math.round(Math.random() * 30 + 10),
          unit: "C",
          conditions: ["sunny", "cloudy", "rainy"][
            Math.floor(Math.random() * 3)
          ],
        }),
      },
      {
        name: "analyze_text",
        description: "Analyze text for word count and sentiment",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
        price: "0.005",
        currency: "USDC",
        merchant: "7nYRmhGKdR4mCfJLfQbAaZ9sGkS3vZoNM3y8EqMkbK8k",
        handler: async (args) => {
          const text = String(args.text);
          return {
            wordCount: text.split(/\s+/).length,
            charCount: text.length,
            sentiment:
              text.includes("good") || text.includes("great")
                ? "positive"
                : "neutral",
          };
        },
      },
    ],
    testMode: true,
    serverInfo: { name: "v402-demo", version: "0.3.0" },
  });

  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("v402 MCP Demo Server running on stdio");
}

main().catch(console.error);
