export default function WhyV402Page() {
  return (
    <article className="max-w-3xl space-y-10 py-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Why v402</h1>
        <p className="mt-3 text-lg text-zinc-400">
          x402 was a good start. v402 fixes what it got wrong.
        </p>
      </header>

      {/* Problem 1: Facilitator */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          1. The facilitator problem
        </h2>
        <p className="text-zinc-300">
          x402 requires a centralized facilitator (Coinbase) to process every
          payment. This creates three problems:
        </p>
        <ul className="list-inside list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-zinc-100">Single point of failure</strong>{" "}
            — If the facilitator goes down, all payments stop. Every tool
            becomes free or unreachable.
          </li>
          <li>
            <strong className="text-zinc-100">Custodial risk</strong> — The
            facilitator holds or processes funds. You&apos;re trusting a third
            party with your agent&apos;s money.
          </li>
          <li>
            <strong className="text-zinc-100">Vendor lock-in</strong> — You
            must use the facilitator&apos;s infrastructure. No alternative
            verification path exists.
          </li>
        </ul>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-sky-300">
            <strong>v402 solution:</strong> Direct on-chain verification via
            Solana RPC. No facilitator. The gateway reads the blockchain
            itself.
          </p>
        </div>
      </section>

      {/* Problem 2: No spending controls */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          2. No agent spending controls
        </h2>
        <p className="text-zinc-300">
          x402 has no built-in mechanism to limit what an agent can spend. A
          compromised or misconfigured agent can drain its wallet calling
          expensive tools with no guardrails.
        </p>
        <p className="text-zinc-300">
          When AI agents operate autonomously — making dozens of tool calls per
          minute — spending controls aren&apos;t optional. They&apos;re
          essential.
        </p>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-sky-300">
            <strong>v402 solution:</strong> Built-in spending policies — daily
            caps, per-call limits, tool allowlists, merchant allowlists, and
            expiry. Enforced both client-side (agent SDK) and server-side
            (gateway).
          </p>
        </div>
      </section>

      {/* Problem 3: No receipts */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          3. No portable receipts
        </h2>
        <p className="text-zinc-300">
          x402 has no standard receipt format. After payment, you have a
          transaction hash — but no cryptographic proof binding the payment to
          the specific tool call, the request, or the response.
        </p>
        <p className="text-zinc-300">
          Without receipts, there&apos;s no way to audit what an agent paid
          for, prove execution happened, or dispute a charge.
        </p>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-sky-300">
            <strong>v402 solution:</strong> Ed25519-signed receipts with intent
            ID, tx signature, amount, payer, merchant, tool ID, request hash,
            response hash, and block height. Verifiable by anyone.
          </p>
        </div>
      </section>

      {/* Problem 4: No tool awareness */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          4. No tool awareness
        </h2>
        <p className="text-zinc-300">
          x402 treats every payment as a generic HTTP transaction. There&apos;s
          no concept of tools, sessions, or per-tool pricing. You can&apos;t
          set different prices for different tools, or let one payment cover
          multiple calls.
        </p>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-sky-300">
            <strong>v402 solution:</strong> Tool-aware intents with{" "}
            <code className="font-mono">tool_id</code>,{" "}
            <code className="font-mono">tool_params_hash</code>,{" "}
            <code className="font-mono">session_id</code>, and{" "}
            <code className="font-mono">max_calls</code>. Session billing
            lets one payment cover N calls. Native MCP integration.
          </p>
        </div>
      </section>

      {/* Summary table */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left">
                <th className="py-2 pr-4 font-medium text-zinc-400">Problem</th>
                <th className="py-2 pr-4 font-medium text-zinc-400">x402</th>
                <th className="py-2 font-medium text-sky-400">v402</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Centralization</td>
                <td className="py-2 pr-4">Requires facilitator</td>
                <td className="py-2">Direct on-chain verification</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Spending safety</td>
                <td className="py-2 pr-4">No controls</td>
                <td className="py-2">Daily caps, per-call, allowlists</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-zinc-400">Receipts</td>
                <td className="py-2 pr-4">No standard format</td>
                <td className="py-2">Ed25519-signed, verifiable</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-zinc-400">Tool awareness</td>
                <td className="py-2 pr-4">Generic HTTP</td>
                <td className="py-2">Per-tool intents, sessions, MCP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
