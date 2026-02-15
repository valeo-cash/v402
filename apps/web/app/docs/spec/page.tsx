import { readFileSync } from "fs";
import path from "path";

export default function SpecPage() {
  const specPath = path.join(process.cwd(), "..", "..", "docs", "spec.md");
  let content: string;
  try {
    content = readFileSync(specPath, "utf8");
  } catch {
    content = "See repo docs/spec.md for the protocol specification.";
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300">{content}</pre>
    </main>
  );
}
