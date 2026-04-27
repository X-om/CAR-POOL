"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/auth/tokenStore";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/auth/sign-in");
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) return null;
  return children;
}
