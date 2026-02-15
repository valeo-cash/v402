"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateToolForm({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const body = {
      merchantId,
      tool_id: (form.elements.namedItem("tool_id") as HTMLInputElement).value,
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLInputElement).value,
      base_url: (form.elements.namedItem("base_url") as HTMLInputElement).value,
      path_pattern: (form.elements.namedItem("path_pattern") as HTMLInputElement).value,
      pricing_model: { per_call: parseFloat((form.elements.namedItem("per_call") as HTMLInputElement).value) || 0 },
      accepted_currency: "USDC",
      merchant_wallet: (form.elements.namedItem("merchant_wallet") as HTMLInputElement).value,
    };
    const res = await fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.text();
      alert(err || "Failed to create tool");
      setLoading(false);
      return;
    }
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
        Add tool
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">Create tool</h2>
        <div className="mt-4 space-y-3">
          <input name="tool_id" placeholder="Tool ID (e.g. my-tool)" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" required />
          <input name="name" placeholder="Name" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" required />
          <input name="description" placeholder="Description" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" />
          <input name="base_url" placeholder="Base URL (e.g. https://api.example.com)" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" required />
          <input name="path_pattern" placeholder="Path pattern (e.g. /v1/run)" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" required />
          <input name="per_call" type="number" step="0.01" placeholder="Per call (USDC)" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" defaultValue="0.1" />
          <input name="merchant_wallet" placeholder="Merchant wallet (Solana address)" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" required />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            Create
          </button>
        </div>
      </div>
    </form>
  );
}
