import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { getMerchantByUserId } from "@/lib/db/merchant";
import { CreateToolForm } from "./CreateToolForm";
import { SetWalletForm } from "./SetWalletForm";

export default async function ToolsPage() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const merchant = await getMerchantByUserId(user.id);
  const merchantId = merchant?.id ?? null;

  if (!merchantId) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Tools</h1>
        <p className="mt-1 text-zinc-400">Set your Solana receiver wallet to register tools.</p>
        <SetWalletForm />
      </div>
    );
  }

  const supabaseAdmin = await import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  );
  const { data: tools } = await supabaseAdmin
    .from("tools")
    .select("id, tool_id, name, base_url, path_pattern, status, metadata_signature")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tools</h1>
        <CreateToolForm merchantId={merchantId} />
      </div>
      <p className="mt-1 text-zinc-400">Registered tools with signed metadata. Gateway only issues intents for verified tools.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 font-medium">Tool ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Base URL</th>
              <th className="px-4 py-3 font-medium">Path</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Signed</th>
            </tr>
          </thead>
          <tbody>
            {(tools ?? []).map((t) => (
              <tr key={t.id} className="border-b border-zinc-800">
                <td className="px-4 py-3 font-mono text-zinc-300">{t.tool_id}</td>
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3 text-zinc-400">{t.base_url}</td>
                <td className="px-4 py-3 text-zinc-400">{t.path_pattern}</td>
                <td className="px-4 py-3">{t.status}</td>
                <td className="px-4 py-3">{t.metadata_signature ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
