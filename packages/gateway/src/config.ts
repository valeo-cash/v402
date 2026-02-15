export type GatewayConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  solanaRpcUrl: string;
  usdcMint: string;
  encryptionKey: string;
  commitment?: "processed" | "confirmed" | "finalized";
  /** When set, gateway uses v402 Cloud instead of Supabase */
  v402ApiKey?: string;
  v402CloudUrl?: string;
};

export function getGatewayConfig(env: NodeJS.ProcessEnv): GatewayConfig {
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const solanaRpcUrl = env.SOLANA_RPC_URL ?? "";
  const usdcMint = env.USDC_MINT ?? "";
  const encryptionKey = env.ENCRYPTION_KEY ?? "";
  const v402ApiKey = env.V402_API_KEY ?? undefined;
  const v402CloudUrl = env.V402_CLOUD_URL ?? "https://api.v402pay.com";

  const useCloud = !!v402ApiKey;
  if (!useCloud && (!supabaseUrl || !supabaseServiceRoleKey || !solanaRpcUrl || !usdcMint || !encryptionKey)) {
    throw new Error(
      "Gateway requires either V402_API_KEY (Cloud) or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOLANA_RPC_URL, USDC_MINT, ENCRYPTION_KEY"
    );
  }
  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    solanaRpcUrl,
    usdcMint,
    encryptionKey,
    commitment: (env.V402_COMMITMENT as "processed" | "confirmed" | "finalized") ?? "confirmed",
    v402ApiKey,
    v402CloudUrl,
  };
}
