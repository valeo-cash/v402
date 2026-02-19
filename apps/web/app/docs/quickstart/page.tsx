export default function QuickstartPage() {
  return (
    <article className="max-w-3xl space-y-10 py-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Quick Start</h1>
        <p className="mt-3 text-zinc-400">
          Integrate v402 payments into your AI agent in under 60 seconds.
        </p>
      </header>

      {/* Step 1 */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Install</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
          <code>npm install @v402pay/agent</code>
        </pre>
        <p className="text-sm text-zinc-400">
          This pulls in the unified SDK with MCP client, server, and spending
          controls.
        </p>
      </section>

      {/* Step 2 */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Create an agent with a spending policy</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
          <code>{`import { createAgent } from "@v402pay/agent";

const agent = createAgent({
  wallet: myWalletAdapter,
  spendingPolicy: {
    dailyCap: 5.0,            // $5/day max
    perCallCap: 0.50,         // 50¢ per tool call
    allowedTools: ["web_search", "code_analysis"],
  },
  onPayment: (event) => console.log("Paid:", event),
  onPolicyViolation: (v) => console.warn("Blocked:", v.reason),
});

// Check budget before calling
console.log(agent.canPay(0.25, "web_search")); // true
console.log(agent.remainingBudget());           // 5.0`}</code>
        </pre>
      </section>

      {/* Step 3 */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Call a paid MCP tool</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
          <code>{`// Connect to an MCP server with paid tools
const { result, paid, receipt } = await agent.mcpClient.callTool(
  mcpClient,
  "web_search",
  { query: "v402 payment protocol" },
);

// The agent automatically:
// 1. Calls the tool → gets 402 + payment intent
// 2. Checks spending policy
// 3. Pays on Solana (USDC)
// 4. Retries with proof
// 5. Returns the result + signed receipt

console.log(result);  // Tool output
console.log(paid);    // true
console.log(receipt); // V402 receipt with Ed25519 signature`}</code>
        </pre>
      </section>

      {/* Step 4 */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Inspect the receipt</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
          <code>{`// The receipt proves the payment happened
{
  "version": 2,
  "intent_id": "abc-123",
  "tx_signature": "5wHu...txSig",
  "amount": "0.25",
  "currency": "USDC",
  "payer": "Agent...Pubkey",
  "merchant": "Merchant...Wallet",
  "tool_id": "web_search",
  "timestamp": 1708300000,
  "block_height": 248000000,
  "receipt_hash": "a1b2c3...",
  "signature": "Ed25519...sig",
  "signer_pubkey": "merchant...key"
}`}</code>
        </pre>
        <p className="text-sm text-zinc-400">
          Receipts are Ed25519-signed by the merchant. Verify any receipt on the{" "}
          <a href="/verify" className="text-sky-400 hover:underline">
            Receipt Verifier
          </a>{" "}
          page.
        </p>
      </section>

      {/* Server side */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Server side (optional)</h2>
        <p className="text-zinc-300">
          If you&apos;re building the paid tool, use the MCP server package:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
          <code>{`import { createV402McpServer } from "@v402pay/agent";

const server = createV402McpServer({
  tools: [
    {
      name: "web_search",
      description: "Search the web",
      inputSchema: { query: { type: "string" } },
      price: "0.01",
      currency: "USDC",
      merchant: "YOUR_WALLET_ADDRESS",
      handler: async (args) => {
        const results = await search(args.query);
        return { results };
      },
    },
  ],
});`}</code>
        </pre>
      </section>
    </article>
  );
}
