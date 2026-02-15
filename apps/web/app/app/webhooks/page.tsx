import { getSupabase } from "@/lib/supabase/server";
import { getMerchantByUserId } from "@/lib/db/merchant";
import { createClient } from "@supabase/supabase-js";

export default async function WebhooksPage() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const merchant = await getMerchantByUserId(user.id);
  if (!merchant) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="mt-2 text-zinc-400">No merchant profile yet.</p>
      </div>
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: webhooks } = await admin
    .from("webhooks")
    .select("id, url, events")
    .eq("merchant_id", merchant.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">Webhooks</h1>
      <p className="mt-1 text-zinc-400">Receive receipt events at your URL.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 font-medium">URL</th>
              <th className="px-4 py-3 font-medium">Events</th>
            </tr>
          </thead>
          <tbody>
            {(webhooks ?? []).map((w) => (
              <tr key={w.id} className="border-b border-zinc-800">
                <td className="px-4 py-3 text-zinc-300">{w.url}</td>
                <td className="px-4 py-3 text-zinc-400">{(w.events ?? []).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
