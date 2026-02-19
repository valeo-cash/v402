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
    <article className="max-w-3xl py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        Protocol Specification v1
      </h1>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
        {content}
      </pre>
    </article>
  );
}
