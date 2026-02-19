import { createToolList, handleToolCall } from "./handlers.js";
import { IntentStore } from "./intent-store.js";
import type { V402McpServerConfig } from "./types.js";

/**
 * Create an MCP Server instance with v402 payment gating.
 *
 * Uses dynamic imports so that `@modelcontextprotocol/sdk` is only loaded at
 * runtime, keeping the module tree light for consumers that only need the
 * handler utilities.
 */
export async function createV402McpServer(config: V402McpServerConfig) {
  const { Server } = await import(
    /* webpackIgnore: true */ "@modelcontextprotocol/sdk/server/index.js"
  );
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
    /* webpackIgnore: true */ "@modelcontextprotocol/sdk/types.js"
  );

  const intentStore = new IntentStore();
  const toolList = createToolList(config.tools);

  const server = new Server(
    {
      name: config.serverInfo?.name ?? "v402-mcp-server",
      version: config.serverInfo?.version ?? "0.3.0",
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({
      tools: toolList.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }),
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: {
      params: { name: string; arguments?: Record<string, unknown> };
    }) => {
      const { name, arguments: args } = request.params;
      return handleToolCall(
        name,
        args ?? {},
        config.tools,
        intentStore,
        config,
      );
    },
  );

  return { server, intentStore };
}
