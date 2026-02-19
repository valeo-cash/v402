/**
 * Solana Agent Kit + v402 demo.
 *
 * Prerequisites:
 *   npm install solana-agent-kit @v402pay/solana-agent-kit
 *
 * Run:
 *   SOLANA_PRIVATE_KEY=<base58> npx tsx agent.ts
 */

import { createV402Plugin } from "@v402pay/solana-agent-kit";

// In a real app you would do:
// import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
// const agent = new SolanaAgentKit(wallet, rpcUrl, config).use(v402Plugin);

const v402Plugin = createV402Plugin({
  spendingPolicy: {
    dailyCap: 5,
    perCallCap: 0.5,
    allowedTools: ["web_search", "weather", "code_interpreter"],
  },
});

// Simulate a SAK agent for demo purposes
const mockAgent: Record<string, unknown> = {
  wallet: { publicKey: { toString: () => "DemoPublicKey" } },
  connection: { rpcEndpoint: "https://api.devnet.solana.com" },
};

async function main() {
  // Check initial budget
  const budget = await v402Plugin.methods.v402CheckBudget(mockAgent);
  console.log("Initial budget:", budget);

  // Check if a payment is allowed
  const canPay = await v402Plugin.methods.v402CanPay(mockAgent, 0.25, "web_search");
  console.log("Can pay 0.25 for web_search?", canPay);

  // Make a payment
  const payment = await v402Plugin.methods.v402PayForTool(
    mockAgent,
    "web_search",
    "0.01",
    "USDC",
    "DemoMerchantWallet",
    "Search query payment",
  );
  console.log("Payment result:", payment);

  // Check remaining budget
  const remaining = await v402Plugin.methods.v402RemainingBudget(mockAgent);
  console.log("Remaining budget:", remaining);

  // Get history
  const history = await v402Plugin.methods.v402GetPaymentHistory(mockAgent);
  console.log("Payment history:", history);
}

main().catch(console.error);
