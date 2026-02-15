import type { SupabaseClient } from "@supabase/supabase-js";

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
    const cap = parseFloat(p.max_spend_per_call);
    if (params.amount > cap) return { allowed: false, reason: "max_spend_per_call exceeded" };
  }
  if (p.max_spend_per_day != null) {
    const cap = parseFloat(p.max_spend_per_day);
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
  return data?.amount != null ? parseFloat(String(data.amount)) : 0;
}

export async function incrementDailySpend(
  supabase: SupabaseClient,
  payer: string,
  amount: number
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("daily_spend")
    .select("id, amount")
    .eq("payer", payer)
    .eq("date_utc", today)
    .maybeSingle();

  const newAmount = (existing?.amount != null ? parseFloat(String(existing.amount)) : 0) + amount;
  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("daily_spend")
      .update({ amount: newAmount, updated_at: now })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update daily_spend: ${error.message}`);
  } else {
    const { error } = await supabase.from("daily_spend").insert({
      payer,
      date_utc: today,
      amount: newAmount,
      updated_at: now,
    });
    if (error) throw new Error(`Failed to insert daily_spend: ${error.message}`);
  }
}
