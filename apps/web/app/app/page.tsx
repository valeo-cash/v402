import Link from "next/link";

export default function AppDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-zinc-400">Manage your tools, receipts, policies, and webhooks.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        <li>
          <Link href="/app/tools" className="block rounded-lg border border-zinc-800 p-6 hover:border-zinc-700">
            <span className="font-medium">Tools</span>
            <p className="mt-1 text-sm text-zinc-400">Register and configure paid tools.</p>
          </Link>
        </li>
        <li>
          <Link href="/app/receipts" className="block rounded-lg border border-zinc-800 p-6 hover:border-zinc-700">
            <span className="font-medium">Receipts</span>
            <p className="mt-1 text-sm text-zinc-400">View payment receipts.</p>
          </Link>
        </li>
        <li>
          <Link href="/app/policies" className="block rounded-lg border border-zinc-800 p-6 hover:border-zinc-700">
            <span className="font-medium">Policies</span>
            <p className="mt-1 text-sm text-zinc-400">Spend caps and allowlists per payer.</p>
          </Link>
        </li>
        <li>
          <Link href="/app/webhooks" className="block rounded-lg border border-zinc-800 p-6 hover:border-zinc-700">
            <span className="font-medium">Webhooks</span>
            <p className="mt-1 text-sm text-zinc-400">Receive receipt events.</p>
          </Link>
        </li>
      </ul>
    </div>
  );
}
