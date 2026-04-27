"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/layout/NavLink";
import { clearSession, getAccessToken } from "@/lib/auth/tokenStore";

export function AppHeader() {
  const router = useRouter();
  const isSignedIn = Boolean(getAccessToken());

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold">
            Car Pool
          </Link>
          {isSignedIn ? (
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink href="/passenger/search">Search</NavLink>
              <NavLink href="/passenger/bookings">Bookings</NavLink>
              <NavLink href="/driver/rides">Driver rides</NavLink>
              <NavLink href="/driver/trips">Trips</NavLink>
              <NavLink href="/driver/vehicles">Vehicles</NavLink>
              <NavLink href="/notifications">Notifications</NavLink>
              <NavLink href="/profile">Profile</NavLink>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Button
              variant="outline"
              onClick={() => {
                clearSession();
                router.push("/auth/sign-in");
              }}
            >
              Sign out
            </Button>
          ) : (
            <Button asChild>
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {isSignedIn ? (
        <div className="border-t bg-muted/20 md:hidden">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2">
            <NavLink href="/passenger/search">Search</NavLink>
            <NavLink href="/passenger/bookings">Bookings</NavLink>
            <NavLink href="/driver/rides">Driver</NavLink>
            <NavLink href="/notifications">Notifications</NavLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}
