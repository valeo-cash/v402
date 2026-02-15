import { getSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export default async function PoliciesPage() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: policies } = await admin
    .from("policies")
    .select("id, payer, api_key_id, max_spend_per_day, max_spend_per_call")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="text-2xl font-bold">Policies</h1>
      <p className="mt-1 text-zinc-400">Spend caps and allowlists per payer. Enforced by the gateway after tx verification.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 font-medium">Payer / API Key</th>
              <th className="px-4 py-3 font-medium">Max per call</th>
              <th className="px-4 py-3 font-medium">Max per day</th>
            </tr>
          </thead>
          <tbody>
            {(policies ?? []).map((p) => (
              <tr key={p.id} className="border-b border-zinc-800">
                <td className="px-4 py-3 font-mono text-zinc-300">{p.payer ?? p.api_key_id ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{p.max_spend_per_call ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{p.max_spend_per_day ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
