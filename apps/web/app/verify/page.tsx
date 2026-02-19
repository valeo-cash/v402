"use client";

import { useState } from "react";
import Link from "next/link";

type ParsedReceipt = Record<string, unknown>;

interface VerifyResult {
  valid: boolean;
  hashValid?: boolean;
  sigValid?: boolean;
  error?: string;
}

export default function VerifyPage() {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [cluster, setCluster] = useState<"mainnet-beta" | "devnet">("mainnet-beta");

  function tryParse(input: string): ParsedReceipt | null {
    try {
      return JSON.parse(input);
    } catch {
      try {
        const decoded = atob(input.trim());
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    }
  }

  async function handleVerify() {
    setResult(null);
    setParseError(null);

    const receipt = tryParse(raw);
    if (!receipt) {
      setParseError("Could not parse input as JSON or base64-encoded JSON.");
      setParsed(null);
      return;
    }
    setParsed(receipt);
    setLoading(true);

    try {
      const res = await fetch("/api/verify-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receipt),
      });
      const data = (await res.json()) as VerifyResult;
      setResult(data);
    } catch {
      setResult({ valid: false, error: "Verification request failed." });
    } finally {
      setLoading(false);
    }
  }

  const txSig =
    parsed &&
    ((parsed.tx_signature as string) || (parsed.txSig as string) || null);

  const explorerUrl = txSig
    ? `https://explorer.solana.com/tx/${txSig}${cluster === "devnet" ? "?cluster=devnet" : ""}`
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">
        &larr; Docs
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        Receipt Verifier
      </h1>
      <p className="mt-2 text-zinc-400">
        Paste a <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-sky-300">V402-Receipt</code>{" "}
        value to verify its Ed25519 signature.
      </p>

      {/* Cluster selector */}
      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm text-zinc-400">Solana cluster:</label>
        <select
          value={cluster}
          onChange={(e) =>
            setCluster(e.target.value as "mainnet-beta" | "devnet")
          }
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        >
          <option value="mainnet-beta">Mainnet</option>
          <option value="devnet">Devnet</option>
        </select>
      </div>

      {/* Input */}
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='Paste V402-Receipt JSON or base64 here…'
        rows={8}
        className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
      />

      <button
        onClick={handleVerify}
        disabled={!raw.trim() || loading}
        className="mt-3 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Verify Receipt"}
      </button>

      {/* Parse error */}
      {parseError && (
        <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {parseError}
        </p>
      )}

      {/* Parsed fields */}
      {parsed && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Parsed receipt</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(parsed).map(([key, value]) => (
                  <tr key={key} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                      {key}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-200 break-all">
                      {String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Solana Explorer link */}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-sky-400 hover:underline"
            >
              View transaction on Solana Explorer &rarr;
            </a>
          )}
        </div>
      )}

      {/* Verification result */}
      {result && (
        <div
          className={`mt-6 rounded-lg border p-4 ${
            result.valid
              ? "border-green-500/30 bg-green-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <p className="text-lg font-semibold">
            {result.valid ? "✅ Valid" : "❌ Invalid"}
          </p>

          {result.hashValid !== undefined && (
            <ul className="mt-2 space-y-1 text-sm">
              <li className={result.hashValid ? "text-green-400" : "text-red-400"}>
                Receipt hash: {result.hashValid ? "matches" : "mismatch"}
              </li>
              <li className={result.sigValid ? "text-green-400" : "text-red-400"}>
                Ed25519 signature: {result.sigValid ? "valid" : "invalid"}
              </li>
            </ul>
          )}

          {result.error && (
            <p className="mt-2 text-sm text-red-400">{result.error}</p>
          )}
        </div>
      )}
    </main>
  );
}
