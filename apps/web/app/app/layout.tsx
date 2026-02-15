import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/app" className="font-semibold">v402pay Dashboard</Link>
          <div className="flex gap-6">
            <Link href="/app/tools" className="text-zinc-400 hover:text-zinc-100">Tools</Link>
            <Link href="/app/receipts" className="text-zinc-400 hover:text-zinc-100">Receipts</Link>
            <Link href="/app/policies" className="text-zinc-400 hover:text-zinc-100">Policies</Link>
            <Link href="/app/webhooks" className="text-zinc-400 hover:text-zinc-100">Webhooks</Link>
            <span className="text-zinc-500">{user.email}</span>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
