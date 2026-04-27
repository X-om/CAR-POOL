import { AppHeader } from "@/components/layout/AppHeader";
import type { ReactNode } from "react";

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto flex max-w-6xl flex-col px-4 py-10">
        {children}
      </main>
    </div>
  );
}
