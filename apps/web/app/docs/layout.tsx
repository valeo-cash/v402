import { DocsSidebar } from "./DocsSidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-6xl px-6">
      <DocsSidebar />
      <main className="min-w-0 flex-1 py-8 pl-0 md:pl-8">{children}</main>
    </div>
  );
}
