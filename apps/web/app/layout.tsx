import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "v402pay",
  description: "Non-custodial payments and execution for AI agents on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
