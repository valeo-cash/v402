"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/quickstart", label: "Quick Start" },
  { href: "/docs/architecture", label: "Architecture" },
  { href: "/docs/protocol-spec", label: "Protocol Spec v2" },
  { href: "/docs/packages", label: "Packages" },
  { href: "/docs/why-v402", label: "Why v402" },
  { href: "/docs/spec", label: "Spec v1 (raw)" },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-56 shrink-0 border-r border-zinc-800 py-8 pr-6 md:block">
      <Link href="/" className="mb-8 block text-lg font-bold tracking-tight">
        v402
      </Link>

      <ul className="space-y-1">
        {NAV.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={`block rounded px-3 py-1.5 text-sm transition-colors ${
                pathname === href
                  ? "bg-sky-500/10 font-medium text-sky-400"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-zinc-800 pt-6">
        <Link
          href="/verify"
          className="block rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
        >
          Receipt Verifier
        </Link>
        <Link
          href="/app"
          className="mt-1 block rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
        >
          Dashboard
        </Link>
      </div>
    </nav>
  );
}
