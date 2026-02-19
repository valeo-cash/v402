import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Parse a decimal string to number for policy comparisons. Throws if invalid (avoids NaN).
 */
export function safeParseDecimal(value: string): number {
  const s = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid decimal amount: ${value}`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Invalid decimal amount: ${value}`);
  return n;
}

export type PolicyRow = {
  max_spend_per_day: string | null;
  max_spend_per_call: string | null;
  allowlisted_tool_ids: string[] | null;
  allowlisted_merchants: string[] | null;
};

export async function getPolicyByPayer(
  supabase: SupabaseClient,
  payer: string
): Promise<PolicyRow | null> {
  const { data } = await supabase
    .from("policies")
    .select("max_spend_per_day, max_spend_per_call, allowlisted_tool_ids, allowlisted_merchants")
    .eq("payer", payer)
    .maybeSingle();
  return data as PolicyRow | null;
}

export function checkPolicy(
  policy: PolicyRow | null | Record<string, unknown>,
  params: {
    amount: number;
    toolId: string;
    merchantWallet: string;
    dailySpend: number;
  }
): { allowed: boolean; reason?: string } {
  if (!policy || typeof policy !== "object") return { allowed: true };
  const p = policy as PolicyRow;

  if (p.max_spend_per_call != null) {
    const cap = safeParseDecimal(p.max_spend_per_call);
    if (params.amount > cap) return { allowed: false, reason: "max_spend_per_call exceeded" };
  }
  if (p.max_spend_per_day != null) {
    const cap = safeParseDecimal(p.max_spend_per_day);
    if (params.dailySpend + params.amount > cap)
      return { allowed: false, reason: "max_spend_per_day exceeded" };
  }
  if (p.allowlisted_tool_ids != null && p.allowlisted_tool_ids.length > 0) {
    if (!p.allowlisted_tool_ids.includes(params.toolId))
      return { allowed: false, reason: "tool not allowlisted" };
  }
  if (p.allowlisted_merchants != null && p.allowlisted_merchants.length > 0) {
    if (!p.allowlisted_merchants.includes(params.merchantWallet))
      return { allowed: false, reason: "merchant not allowlisted" };
  }
  return { allowed: true };
}

/**
 * Check whether a specific tool_id is permitted by the policy's tool allowlist.
 */
export function checkToolPolicy(
  toolId: string | undefined,
  policy: { allowlisted_tool_ids?: string[] }
): { allowed: boolean; reason?: string } {
  if (!toolId || !policy.allowlisted_tool_ids || policy.allowlisted_tool_ids.length === 0) {
    return { allowed: true };
  }
  if (!policy.allowlisted_tool_ids.includes(toolId)) {
    return { allowed: false, reason: `Tool "${toolId}" not in allowlist` };
  }
  return { allowed: true };
}

/**
 * Check whether a session intent has remaining calls.
 */
export function checkSessionAllowed(
  intent: { max_calls?: number | null; calls_used?: number | null }
): { allowed: boolean; reason?: string } {
  if (intent.max_calls == null) return { allowed: true };
  const used = intent.calls_used ?? 0;
  if (used >= intent.max_calls) {
    return { allowed: false, reason: "Session call limit reached" };
  }
  return { allowed: true };
}

export async function getDailySpend(
  supabase: SupabaseClient,
  payer: string
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_spend")
    .select("amount")
    .eq("payer", payer)
    .eq("date_utc", today)
    .maybeSingle();
  return data?.amount != null ? safeParseDecimal(String(data.amount)) : 0;
}

export async function incrementDailySpend(
  supabase: SupabaseClient,
  payer: string,
  amount: number
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.rpc("increment_daily_spend", {
    p_payer: payer,
    p_date: today,
    p_amount: String(amount),
  });
  if (error) throw new Error(`Failed to increment daily_spend: ${error.message}`);
}
