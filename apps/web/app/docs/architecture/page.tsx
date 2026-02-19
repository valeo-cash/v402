export default function ArchitecturePage() {
  return (
    <article className="max-w-3xl space-y-10 py-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Architecture</h1>
        <p className="mt-3 text-zinc-400">
          How v402 works — from the first 402 response to the signed receipt.
        </p>
      </header>

      {/* Flow diagram */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Full payment flow</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-300">
{`Agent                           Gateway                        Solana
  │                               │                               │
  │─── GET /tool ────────────────▶│                               │
  │◀── 402 + Payment Intent ──────│                               │
  │                               │                               │
  │─── Sign + send tx ───────────────────────────────────────────▶│
  │◀── tx signature ─────────────────────────────────────────────│
  │                               │                               │
  │─── Retry + V402-Tx header ──▶│                               │
  │                               │── Verify on-chain ──────────▶│
  │                               │◀── Confirmed ───────────────│
  │                               │── Check spending policy       │
  │                               │── Forward to tool server ────▶│
  │                               │◀── Tool result ──────────────│
  │◀── 200 + V402-Receipt ────────│                               │`}
        </pre>
      </section>

      {/* Why no facilitator */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Why no facilitator</h2>
        <p className="text-zinc-300">
          In x402, a centralized facilitator (Coinbase) sits between the client
          and server. It custodies funds, processes payments, and becomes a
          single point of failure. If the facilitator goes down, all payments
          stop.
        </p>
        <p className="text-zinc-300">
          v402 eliminates the facilitator entirely. The gateway verifies
          payments by reading the Solana blockchain directly via RPC. The
          agent&apos;s wallet signs the transaction, Solana settles it, and the
          gateway confirms it — no third party involved.
        </p>
        <div className="rounded-lg border border-zinc-800 p-4">
          <p className="text-sm text-zinc-400">
            <strong className="text-zinc-200">x402:</strong> Agent → Facilitator → Server
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            <strong className="text-sky-400">v402:</strong> Agent → Solana (on-chain) → Gateway verifies directly
          </p>
        </div>
      </section>

      {/* On-chain verification */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">On-chain verification</h2>
        <p className="text-zinc-300">
          When the agent retries with proof, the gateway verifies the Solana
          transaction:
        </p>
        <ol className="list-inside list-decimal space-y-2 text-zinc-300">
          <li>
            <strong className="text-zinc-100">Memo check</strong> — The
            transaction must contain a memo instruction with{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
              v402:&lt;reference&gt;
            </code>{" "}
            matching the intent&apos;s reference UUID.
          </li>
          <li>
            <strong className="text-zinc-100">Amount check</strong> — The
            transfer amount must match the intent (USDC: 6 decimals, SOL: 9
            decimals).
          </li>
          <li>
            <strong className="text-zinc-100">Recipient check</strong> — The
            transfer must go to the merchant&apos;s wallet address.
          </li>
          <li>
            <strong className="text-zinc-100">Expiry check</strong> — The
            transaction&apos;s block time must be before the intent&apos;s{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
              expiresAt
            </code>
            .
          </li>
          <li>
            <strong className="text-zinc-100">Payer derivation</strong> — The
            payer is always derived from the on-chain transaction, never from
            client headers. SOL: fee payer. USDC: source token account owner.
          </li>
        </ol>
      </section>

      {/* Policy enforcement */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Policy enforcement</h2>
        <p className="text-zinc-300">
          After verifying the transaction, the gateway checks the payer&apos;s
          spending policy:
        </p>
        <ul className="list-inside list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-zinc-100">Daily cap</strong> — Total
            spending for the UTC day must not exceed the limit.
          </li>
          <li>
            <strong className="text-zinc-100">Per-call cap</strong> — Individual
            payment must not exceed the per-call maximum.
          </li>
          <li>
            <strong className="text-zinc-100">Tool allowlist</strong> — The{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
              tool_id
            </code>{" "}
            must be in the payer&apos;s allowed tools list (if set).
          </li>
          <li>
            <strong className="text-zinc-100">Merchant allowlist</strong> — The
            merchant must be in the payer&apos;s allowed merchants list (if
            set).
          </li>
        </ul>
        <p className="text-zinc-300">
          Policy enforcement happens server-side in the gateway, keyed by the
          on-chain-derived payer address. Client-side policy checking (via the
          agent SDK) provides defense-in-depth.
        </p>
      </section>

      {/* Receipts */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Receipts</h2>
        <p className="text-zinc-300">
          After the tool executes, the gateway issues an Ed25519-signed receipt
          in the{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
            V402-Receipt
          </code>{" "}
          response header. The receipt includes:
        </p>
        <ul className="list-inside list-disc space-y-1 text-zinc-300">
          <li>Intent ID, transaction signature, amount, currency</li>
          <li>On-chain-derived payer and merchant addresses</li>
          <li>Tool ID, timestamp, block height</li>
          <li>
            SHA-256{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
              receipt_hash
            </code>{" "}
            of the canonical payload
          </li>
          <li>Ed25519 signature over the receipt hash</li>
        </ul>
        <p className="text-zinc-300">
          Anyone can verify a receipt by recomputing the hash and checking the
          Ed25519 signature against the signer&apos;s public key. Try the{" "}
          <a href="/verify" className="text-sky-400 hover:underline">
            Receipt Verifier
          </a>
          .
        </p>
      </section>

      {/* Session billing */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Session billing (v2)</h2>
        <p className="text-zinc-300">
          v2 adds session-based billing: one payment covers multiple tool calls.
          The merchant configures{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
            max_calls_per_session
          </code>{" "}
          on the route. After the first payment, subsequent requests with the{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
            V402-Session
          </code>{" "}
          header are forwarded without new payment until{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
            calls_used
          </code>{" "}
          reaches{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">
            max_calls
          </code>
          .
        </p>
      </section>
    </article>
  );
}
