export { createAgent } from "./agent.js";
export type { V402Agent } from "./agent.js";
export type {
  SpendingPolicy,
  AgentConfig,
  PaymentEvent,
  PolicyViolation,
  AgentStats,
} from "./types.js";

// Re-export mcp-client (exclude SpendingPolicy to avoid name clash)
export {
  SpendingTracker,
  createV402McpClient,
} from "@v402pay/mcp-client";
export type {
  V402McpClient,
  WalletAdapter,
  McpClientLike,
  McpToolCallResponse,
  V402McpClientConfig,
  CallToolResult,
  PaymentRecord,
} from "@v402pay/mcp-client";

// Re-export mcp-server
export {
  IntentStore,
  createToolList,
  handleToolCall,
  createV402McpServer,
} from "@v402pay/mcp-server";
export type {
  PaidTool,
  V402McpServerConfig,
  McpToolDef,
  StoredIntent,
} from "@v402pay/mcp-server";
