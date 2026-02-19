import { createAgent } from "@v402pay/agent";
import type { V402Agent } from "@v402pay/agent";
import type { WalletAdapter } from "@v402pay/agent";
import type { SolanaAgentKitLike, V402PluginConfig } from "./types/index.js";

const AGENT_KEY = "_v402Agent";

export function getOrInitV402Agent(
  sakAgent: SolanaAgentKitLike,
  config: V402PluginConfig,
): V402Agent {
  if (sakAgent[AGENT_KEY]) return sakAgent[AGENT_KEY] as V402Agent;

  const walletAdapter: WalletAdapter = {
    pay: async () => {
      throw new Error(
        "Direct wallet pay not available — use the v402 gateway 402→pay→retry flow",
      );
    },
    getPublicKey: () =>
      sakAgent.wallet?.publicKey?.toString() ?? "",
  };

  const v402 = createAgent({
    wallet: walletAdapter,
    spendingPolicy: {
      dailyCap: config.spendingPolicy.dailyCap,
      perCallCap: config.spendingPolicy.perCallCap,
      allowedTools: config.spendingPolicy.allowedTools,
      allowedMerchants: config.spendingPolicy.allowedMerchants,
      expiry: config.spendingPolicy.expiry,
    },
    rpcUrl: config.verifyRpcUrl,
  });

  sakAgent[AGENT_KEY] = v402;
  return v402;
}
