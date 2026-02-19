export interface RouteConfig {
  amount: string;
  currency: "SOL" | "USDC";
  merchant: string;
  tool_id?: string;
  max_calls_per_session?: number;
  require_spending_account?: boolean;
}

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
  /** Test only: skip on-chain/Cloud verification and accept any proof; emit a fake receipt. Do not set in production. */
  testMode?: boolean;
  /** Max 402 intents per key per window (default 60). */
  intentRateLimit?: number;
  /** Rate limit window in ms (default 60000). */
  intentRateWindowMs?: number;
};

export function getGatewayConfig(env: NodeJS.ProcessEnv): GatewayConfig {
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const solanaRpcUrl = env.SOLANA_RPC_URL ?? "";
  const usdcMint = env.USDC_MINT ?? "";
  const encryptionKey = env.ENCRYPTION_KEY ?? "";
  const v402ApiKey = env.V402_API_KEY ?? undefined;
  const v402CloudUrl = env.V402_CLOUD_URL ?? "https://api.v402pay.com";
  const testMode = env.V402_TEST_MODE === "true" || env.V402_TEST_MODE === "1";

  const useCloud = !!v402ApiKey;
  if (!useCloud && (!supabaseUrl || !supabaseServiceRoleKey || !solanaRpcUrl || !usdcMint || !encryptionKey)) {
    throw new Error(
      "Gateway requires either V402_API_KEY (Cloud) or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOLANA_RPC_URL, USDC_MINT, ENCRYPTION_KEY"
    );
  }
  const intentRateLimit = env.V402_INTENT_RATE_LIMIT != null ? parseInt(env.V402_INTENT_RATE_LIMIT, 10) : undefined;
  const intentRateWindowMs = env.V402_INTENT_RATE_WINDOW_MS != null ? parseInt(env.V402_INTENT_RATE_WINDOW_MS, 10) : undefined;
  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    solanaRpcUrl,
    usdcMint,
    encryptionKey,
    commitment: (env.V402_COMMITMENT as "processed" | "confirmed" | "finalized") ?? "confirmed",
    v402ApiKey,
    v402CloudUrl,
    testMode: testMode || undefined,
    intentRateLimit: Number.isFinite(intentRateLimit) ? intentRateLimit : undefined,
    intentRateWindowMs: Number.isFinite(intentRateWindowMs) ? intentRateWindowMs : undefined,
  };
}
