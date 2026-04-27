"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavLink(props: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = props.exact
    ? pathname === props.href
    : pathname.startsWith(props.href);

  return (
    <Link
      href={props.href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
        isActive && "bg-muted text-foreground"
      )}
    >
      {props.children}
    </Link>
  );
}
