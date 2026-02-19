import type { V402Agent } from "@v402pay/agent";
import type { McpClientLike } from "@v402pay/agent";

export interface V402ToolConfig {
  agent: V402Agent;
  mcpClient: McpClientLike;
  name: string;
  description: string;
  price: string;
  currency: "USDC" | "SOL";
  merchant: string;
}

/**
 * LangChain-compatible tool that wraps a v402 paid tool.
 *
 * Implements the shape expected by LangChain's StructuredTool so it can be
 * passed directly to LangChain agents. Payment is handled transparently:
 * the tool calls the v402 agent's MCP client, pays on 402, and retries.
 */
export class V402LangChainTool {
  readonly name: string;
  readonly description: string;
  readonly price: string;
  readonly currency: string;
  readonly merchant: string;
  private agent: V402Agent;
  private mcpClient: McpClientLike;

  constructor(config: V402ToolConfig) {
    this.name = config.name;
    this.description = `${config.description} [v402: ${config.price} ${config.currency}]`;
    this.price = config.price;
    this.currency = config.currency;
    this.merchant = config.merchant;
    this.agent = config.agent;
    this.mcpClient = config.mcpClient;
  }

  async _call(input: Record<string, unknown> | string): Promise<string> {
    const args =
      typeof input === "string" ? JSON.parse(input) : input;
    const amount = parseFloat(this.price);

    if (!this.agent.canPay(amount, this.name, this.merchant)) {
      throw new Error(
        `v402 policy denied: cannot pay ${this.price} ${this.currency} for tool "${this.name}"`,
      );
    }

    const { result, paid, receipt } = await this.agent.mcpClient.callTool(
      this.mcpClient,
      this.name,
      args,
    );

    if (paid) {
      this.agent.recordPayment({
        toolName: this.name,
        amount,
        currency: this.currency,
        merchant: this.merchant,
        intentId: (receipt?.intent_id as string) ?? "unknown",
        txSignature: (receipt?.tx_signature as string) ?? "unknown",
        timestamp: Date.now(),
      });
    }

    const text = result.content?.find((c) => c.type === "text")?.text;
    return text ?? JSON.stringify(result.content);
  }
}

export function createV402Tools(
  agent: V402Agent,
  mcpClient: McpClientLike,
  tools: Array<Omit<V402ToolConfig, "agent" | "mcpClient">>,
): V402LangChainTool[] {
  return tools.map(
    (t) => new V402LangChainTool({ ...t, agent, mcpClient }),
  );
}
