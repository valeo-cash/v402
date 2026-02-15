"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SetWalletForm() {
  const router = useRouter();
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/merchant/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to set wallet");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Request failed");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-3">
      <input
        type="text"
        placeholder="Solana wallet address (receiver for payments)"
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm"
        required
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Set wallet"}
      </button>
    </form>
  );
}
