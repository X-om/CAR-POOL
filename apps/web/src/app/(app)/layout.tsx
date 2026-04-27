import { AppHeader } from "@/components/layout/AppHeader";
import { VerificationBanner } from "@/components/layout/VerificationBanner";
import { AuthGate } from "@/lib/auth/AuthGate";
import { ProfileGate } from "@/lib/auth/ProfileGate";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ProfileGate>
        <div className="min-h-dvh">
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 py-8">
            <VerificationBanner />
            {children}
          </main>
        </div>
      </ProfileGate>
    </AuthGate>
  );
}
