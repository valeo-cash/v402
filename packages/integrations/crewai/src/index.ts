import type { V402Agent } from "@v402pay/agent";
import type { McpClientLike } from "@v402pay/agent";

export interface V402CrewAIToolConfig {
  agent: V402Agent;
  mcpClient: McpClientLike;
  name: string;
  description: string;
  price: string;
  currency: "USDC" | "SOL";
  merchant: string;
}

/**
 * CrewAI-compatible tool that wraps a v402 paid tool.
 *
 * Implements the shape expected by CrewAI's Tool interface. Payment is
 * handled transparently via the v402 agent's MCP client.
 */
export class V402CrewAITool {
  readonly name: string;
  readonly description: string;
  readonly price: string;
  readonly currency: string;
  readonly merchant: string;
  private v402Agent: V402Agent;
  private mcpClient: McpClientLike;

  constructor(config: V402CrewAIToolConfig) {
    this.name = config.name;
    this.description = `${config.description} [v402: ${config.price} ${config.currency}]`;
    this.price = config.price;
    this.currency = config.currency;
    this.merchant = config.merchant;
    this.v402Agent = config.agent;
    this.mcpClient = config.mcpClient;
  }

  async _run(input: Record<string, unknown> | string): Promise<string> {
    const args =
      typeof input === "string" ? JSON.parse(input) : input;
    const amount = parseFloat(this.price);

    if (!this.v402Agent.canPay(amount, this.name, this.merchant)) {
      throw new Error(
        `v402 policy denied: cannot pay ${this.price} ${this.currency} for tool "${this.name}"`,
      );
    }

    const { result, paid, receipt } = await this.v402Agent.mcpClient.callTool(
      this.mcpClient,
      this.name,
      args,
    );

    if (paid) {
      this.v402Agent.recordPayment({
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

export function createV402CrewAITools(
  agent: V402Agent,
  mcpClient: McpClientLike,
  tools: Array<Omit<V402CrewAIToolConfig, "agent" | "mcpClient">>,
): V402CrewAITool[] {
  return tools.map(
    (t) => new V402CrewAITool({ ...t, agent, mcpClient }),
  );
}
