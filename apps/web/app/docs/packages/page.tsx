export default function PackagesPage() {
  return (
    <article className="max-w-3xl space-y-12 py-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Packages</h1>
        <p className="mt-3 text-zinc-400">
          API reference for every package in the v402 monorepo.
        </p>
      </header>

      {/* @v402pay/core */}
      <Pkg
        name="@v402pay/core"
        description="Crypto primitives, types, hashing, Solana verification, receipt signing."
        install="npm install @v402pay/core"
        exports={[
          { name: "PaymentIntent", kind: "type", desc: "Payment intent returned with HTTP 402." },
          { name: "ReceiptPayload", kind: "type", desc: "Signed receipt payload." },
          { name: "ToolPaymentIntent", kind: "type", desc: "v2 tool-aware payment intent." },
          { name: "V402ReceiptV2", kind: "type", desc: "v2 receipt with block_height and receipt_hash." },
          { name: "AgentSpendingPolicy", kind: "type", desc: "Server-side spending policy schema." },
          { name: "VerifiedPayment", kind: "type", desc: "Result of on-chain payment verification." },
          { name: "requestHash(method, path, query, body, contentType)", kind: "function", desc: "SHA-256 hash of canonical request." },
          { name: "buildCanonicalRequest(…)", kind: "function", desc: "Build canonical request string for hashing." },
          { name: "verifySolanaPayment(config)", kind: "function", desc: "Verify a Solana transaction matches an intent." },
          { name: "signReceipt(payload, key)", kind: "function", desc: "Ed25519-sign a receipt payload." },
          { name: "verifyReceiptSignature(payload, sig, pubkey)", kind: "function", desc: "Verify a receipt's Ed25519 signature." },
          { name: "parseAmount(amount, currency)", kind: "function", desc: "Parse decimal amount to lamports/base units." },
        ]}
      />

      {/* @v402pay/sdk */}
      <Pkg
        name="@v402pay/sdk"
        description="Client-side 402 → pay → retry flow with wallet adapters."
        install="npm install @v402pay/sdk"
        exports={[
          { name: "createV402Client(options)", kind: "function", desc: "Create a fetch wrapper that handles 402 → pay → retry automatically." },
          { name: "createKeypairAdapter(options)", kind: "function", desc: "Wallet adapter from a Solana Keypair (dev/CLI use)." },
          { name: "createWalletStandardAdapter(…)", kind: "function", desc: "Wallet adapter from a Wallet Standard wallet (Phantom, etc.)." },
          { name: "V402PaymentError", kind: "class", desc: "Error thrown when payment fails." },
          { name: "V402WalletAdapter", kind: "type", desc: "Wallet adapter interface for signing and sending transactions." },
        ]}
      />

      {/* @v402pay/gateway */}
      <Pkg
        name="@v402pay/gateway"
        description="Server middleware: intent creation, policy enforcement, tx verification, receipt issuance."
        install="npm install @v402pay/gateway"
        exports={[
          { name: "createGatewayContext(env)", kind: "function", desc: "Create gateway context from environment variables." },
          { name: "handleV402(req, ctx)", kind: "function", desc: "Core 402 handler — creates intents, verifies payments, issues receipts." },
          { name: "v402Gateway(ctx)", kind: "function", desc: "Express middleware." },
          { name: "v402GatewayFastify(ctx, fastify)", kind: "function", desc: "Fastify plugin." },
          { name: "withV402Gateway(ctx, handler)", kind: "function", desc: "Next.js route wrapper." },
          { name: "checkPolicy(supabase, payer, amount, toolId)", kind: "function", desc: "Check spending policy for a payer." },
          { name: "checkToolPolicy(toolId, policy)", kind: "function", desc: "Check if a tool is in the policy's allowlist." },
          { name: "checkSessionAllowed(intent)", kind: "function", desc: "Check if a session intent has remaining calls." },
          { name: "RouteConfig", kind: "type", desc: "Per-route billing configuration (amount, currency, tool_id, max_calls_per_session)." },
        ]}
      />

      {/* @v402pay/mcp-server */}
      <Pkg
        name="@v402pay/mcp-server"
        description="MCP server with v402 payment-gated tools."
        install="npm install @v402pay/mcp-server"
        exports={[
          { name: "createV402McpServer(config)", kind: "function", desc: "Create an MCP server with paid tools. Returns an MCP Server instance." },
          { name: "createToolList(tools)", kind: "function", desc: "Build MCP tool definitions with v402 pricing metadata." },
          { name: "handleToolCall(tools, store, request)", kind: "function", desc: "Handle a tool call — manage payment intents and execute handlers." },
          { name: "PaidTool", kind: "type", desc: "Tool definition with name, schema, price, currency, merchant, and handler." },
          { name: "V402McpServerConfig", kind: "type", desc: "Server configuration (tools, testMode, solanaRpcUrl)." },
          { name: "IntentStore", kind: "class", desc: "In-memory intent store for tracking payment state." },
        ]}
      />

      {/* @v402pay/mcp-client */}
      <Pkg
        name="@v402pay/mcp-client"
        description="MCP client with automatic payment and client-side policy enforcement."
        install="npm install @v402pay/mcp-client"
        exports={[
          { name: "createV402McpClient(config)", kind: "function", desc: "Create a client that automatically pays for tool calls." },
          { name: "SpendingTracker", kind: "class", desc: "Tracks daily spending and enforces client-side policy." },
          { name: "WalletAdapter", kind: "type", desc: "Wallet interface: pay(params) → { txSig }." },
          { name: "McpClientLike", kind: "type", desc: "Minimal MCP client interface for callTool()." },
          { name: "SpendingPolicy", kind: "type", desc: "Client-side policy: dailyCap, perCallCap, allowedTools, allowedMerchants." },
          { name: "CallToolResult", kind: "type", desc: "Result of callTool: { result, paid, receipt }." },
        ]}
      />

      {/* @v402pay/agent */}
      <Pkg
        name="@v402pay/agent"
        description="Unified agent SDK — payments + spending policy + MCP in one import."
        install="npm install @v402pay/agent"
        exports={[
          { name: "createAgent(config)", kind: "function", desc: "Create an agent with wallet, spending policy, and MCP client." },
          { name: "agent.canPay(amount, toolId?, merchant?)", kind: "method", desc: "Check if a payment is allowed by policy." },
          { name: "agent.remainingBudget()", kind: "method", desc: "Remaining daily budget." },
          { name: "agent.getStats()", kind: "method", desc: "Daily spent, daily cap, total payments, total spent." },
          { name: "agent.getPaymentHistory()", kind: "method", desc: "All recorded payments." },
          { name: "agent.mcpClient", kind: "property", desc: "Pre-configured V402McpClient with policy applied." },
          { name: "SpendingPolicy", kind: "type", desc: "Policy with dailyCap (required), perCallCap, allowedTools, allowedMerchants, expiry." },
          { name: "AgentConfig", kind: "type", desc: "Config: wallet, spendingPolicy, onPayment, onPolicyViolation." },
        ]}
      />

      {/* @v402pay/langchain */}
      <Pkg
        name="@v402pay/langchain"
        description="LangChain integration — v402 paid tools as LangChain StructuredTools."
        install="npm install @v402pay/langchain"
        exports={[
          { name: "V402LangChainTool", kind: "class", desc: "LangChain-compatible tool wrapper. Handles payment automatically on _call()." },
          { name: "createV402Tools(agent, mcpClient, tools)", kind: "function", desc: "Batch-create LangChain tools from v402 tool definitions." },
          { name: "V402ToolConfig", kind: "type", desc: "Config: agent, mcpClient, name, description, price, currency, merchant." },
        ]}
      />

      {/* @v402pay/crewai */}
      <Pkg
        name="@v402pay/crewai"
        description="CrewAI integration — v402 paid tools for CrewAI agents."
        install="npm install @v402pay/crewai"
        exports={[
          { name: "V402CrewAITool", kind: "class", desc: "CrewAI-compatible tool wrapper. Handles payment automatically on _run()." },
          { name: "createV402CrewAITools(agent, mcpClient, tools)", kind: "function", desc: "Batch-create CrewAI tools from v402 tool definitions." },
          { name: "V402CrewAIToolConfig", kind: "type", desc: "Config: agent, mcpClient, name, description, price, currency, merchant." },
        ]}
      />
    </article>
  );
}

function Pkg({
  name,
  description,
  install,
  exports: items,
}: {
  name: string;
  description: string;
  install: string;
  exports: Array<{ name: string; kind: string; desc: string }>;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          <code className="text-sky-400">{name}</code>
        </h2>
        <p className="mt-1 text-zinc-400">{description}</p>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
        <code>{install}</code>
      </pre>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left">
              <th className="py-1.5 pr-3 font-medium text-zinc-400">Export</th>
              <th className="py-1.5 pr-3 font-medium text-zinc-400">Kind</th>
              <th className="py-1.5 font-medium text-zinc-400">Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.name} className="border-b border-zinc-800/50">
                <td className="py-1.5 pr-3">
                  <code className="text-xs text-zinc-200">{e.name}</code>
                </td>
                <td className="py-1.5 pr-3 text-xs text-zinc-500">{e.kind}</td>
                <td className="py-1.5 text-zinc-400">{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
