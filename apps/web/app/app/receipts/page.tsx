import { getSupabase } from "@/lib/supabase/server";
import { getMerchantByUserId } from "@/lib/db/merchant";
import { createClient } from "@supabase/supabase-js";

export default async function ReceiptsPage() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const merchant = await getMerchantByUserId(user.id);
  if (!merchant) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="mt-2 text-zinc-400">No merchant profile yet. Use the dashboard to get started.</p>
      </div>
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: toolIds } = await admin
    .from("tools")
    .select("id")
    .eq("merchant_id", merchant.id);
  const ids = (toolIds ?? []).map((t) => t.id);
  const { data: receipts } = await admin
    .from("receipts")
    .select("receipt_id, intent_id, tx_sig, payer, merchant, timestamp, request_hash")
    .in("tool_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("timestamp", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold">Receipts</h1>
      <p className="mt-1 text-zinc-400">Payment receipts for your tools.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 font-medium">Receipt ID</th>
              <th className="px-4 py-3 font-medium">Intent ID</th>
              <th className="px-4 py-3 font-medium">Tx</th>
              <th className="px-4 py-3 font-medium">Payer</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {(receipts ?? []).map((r) => (
              <tr key={r.receipt_id} className="border-b border-zinc-800">
                <td className="px-4 py-3 font-mono text-zinc-300">{r.receipt_id}</td>
                <td className="px-4 py-3 font-mono text-zinc-400">{r.intent_id}</td>
                <td className="max-w-[120px] truncate font-mono text-zinc-400">{r.tx_sig}</td>
                <td className="max-w-[120px] truncate font-mono text-zinc-400">{r.payer}</td>
                <td className="px-4 py-3 text-zinc-400">{new Date(r.timestamp).toISOString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
