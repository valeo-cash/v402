import Link from "next/link";

export default function DocsLanding() {
  return (
    <article className="max-w-3xl space-y-10 py-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">v402 Documentation</h1>
        <p className="mt-3 text-lg text-zinc-400">
          The payment protocol for autonomous AI agents.
        </p>
      </header>

      {/* What is v402 */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What is v402?</h2>
        <p className="text-zinc-300">
          <strong className="text-zinc-100">v402</strong> is a non-custodial
          payment protocol for AI agents on Solana. It uses HTTP 402 to gate
          access to paid tools and APIs. Agents pay with USDC or SOL from their
          own wallets, then retry with on-chain proof. No middleman touches
          funds. Receipts are Ed25519-signed and verifiable.
        </p>
        <p className="rounded border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sky-300">
          x402 lets agents pay. <strong>v402 lets agents pay safely.</strong>
        </p>
      </section>

      {/* Feature comparison */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">v402 vs x402</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left">
                <th className="py-2 pr-4 font-medium text-zinc-400">Feature</th>
                <th className="py-2 pr-4 font-medium text-sky-400">v402</th>
                <th className="py-2 font-medium text-zinc-400">x402</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Facilitator</td>
                <td className="py-2 pr-4">None &mdash; direct on-chain</td>
                <td className="py-2">Required (Coinbase)</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Spending controls</td>
                <td className="py-2 pr-4">Built-in: daily caps, per-call, tool/merchant allowlists</td>
                <td className="py-2">None</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Signed receipts</td>
                <td className="py-2 pr-4">Ed25519-signed, verifiable</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Tool-aware intents</td>
                <td className="py-2 pr-4">Yes &mdash; per-tool billing, sessions</td>
                <td className="py-2">No</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">MCP integration</td>
                <td className="py-2 pr-4">Native server &amp; client</td>
                <td className="py-2">No</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-zinc-400">Chain</td>
                <td className="py-2 pr-4">Solana (USDC / SOL)</td>
                <td className="py-2">Base (EVM)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Navigation */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Get started</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/docs/quickstart", title: "Quick Start", desc: "60-second integration" },
            { href: "/docs/architecture", title: "Architecture", desc: "How v402 works under the hood" },
            { href: "/docs/protocol-spec", title: "Protocol Spec v2", desc: "Full specification" },
            { href: "/docs/packages", title: "Packages", desc: "API reference for every package" },
            { href: "/docs/why-v402", title: "Why v402", desc: "What x402 gets wrong" },
            { href: "/verify", title: "Receipt Verifier", desc: "Verify any v402 receipt" },
          ].map(({ href, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-zinc-800 p-4 transition-colors hover:border-sky-500/40 hover:bg-sky-500/5"
            >
              <p className="font-medium text-zinc-100">{title}</p>
              <p className="mt-1 text-sm text-zinc-400">{desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
