import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">v402pay</h1>
      <p className="mt-2 text-zinc-400">
        Non-custodial payments and execution protocol for AI agents on Solana.
      </p>
      <ul className="mt-8 space-y-2">
        <li>
          <Link href="/docs/spec" className="text-sky-400 hover:underline">
            Protocol spec
          </Link>
        </li>
        <li>
          <Link href="/app" className="text-sky-400 hover:underline">
            Dashboard
          </Link>
        </li>
        <li>
          <Link href="/login" className="text-sky-400 hover:underline">
            Log in
          </Link>
        </li>
      </ul>
    </main>
  );
}
