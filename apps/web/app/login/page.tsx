"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      alert(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-zinc-300">Check your email for the magic link.</p>
        <Link href="/" className="mt-4 inline-block text-sky-400 hover:underline">Back home</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-zinc-400">We’ll send you a magic link.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          required
        />
        <button type="submit" className="w-full rounded bg-sky-600 px-3 py-2 font-medium text-white hover:bg-sky-700">
          Send magic link
        </button>
      </form>
    </main>
  );
}
