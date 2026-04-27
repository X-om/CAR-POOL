"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserProfile } from "@/features/profile/api/profileApi";
import { getUserId } from "@/lib/auth/tokenStore";
import { queryKeys } from "@/lib/query/keys";

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const userId = getUserId();

  const profileQuery = useQuery({
    queryKey: userId ? queryKeys.userProfile(userId) : ["userProfile", "missing"],
    queryFn: async () => {
      if (!userId) throw new Error("Missing user session");
      return getUserProfile(userId);
    },
    enabled: Boolean(userId),
  });

  React.useEffect(() => {
    if (!userId) {
      router.replace("/auth/sign-in");
      return;
    }

    const profile = profileQuery.data;
    if (!profile) return;

    const isProfileComplete = Boolean(profile.name.trim());
    const isOnProfilePage = pathname === "/profile";
    const isOnVerifyPage = pathname === "/verify";

    if (!isProfileComplete && !isOnProfilePage && !isOnVerifyPage) {
      const qs = new URLSearchParams({ next: pathname });
      router.replace(`/profile?${qs.toString()}`);
    }
  }, [pathname, profileQuery.data, router, userId]);

  if (!userId) return null;

  if (pathname === "/profile" || pathname === "/verify") return children;

  if (profileQuery.isPending) return null;

  if (profileQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Failed to load profile</CardTitle>
          <CardDescription>
            {profileQuery.error instanceof Error
              ? profileQuery.error.message
              : "Unknown error"}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <Button variant="outline" onClick={() => profileQuery.refetch()}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const isProfileComplete = Boolean(profile?.name.trim());

  if (!isProfileComplete && pathname !== "/profile" && pathname !== "/verify") {
    return null;
  }

  return children;
}
