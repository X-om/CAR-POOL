"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUser } from "@/features/users/api/usersApi";
import { getUserId } from "@/lib/auth/tokenStore";
import { queryKeys } from "@/lib/query/keys";

export function VerificationBanner() {
  const userId = getUserId();

  const userQuery = useQuery({
    queryKey: userId ? queryKeys.user(userId) : ["user", "missing"],
    queryFn: async () => {
      if (!userId) throw new Error("Missing session");
      return getUser(userId);
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const user = userQuery.data;

  if (!user) return null;
  if (user.isVerified) return null;

  const missing: string[] = [];
  if (!user.isPhoneVerified) missing.push("phone");
  if (!user.isEmailVerified) missing.push("email");
  if (missing.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="text-sm">
          <div className="font-medium">Complete verification</div>
          <div className="text-muted-foreground">
            Verify your {missing.join(" and ")} to unlock full access.
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/verify">Verify now</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
