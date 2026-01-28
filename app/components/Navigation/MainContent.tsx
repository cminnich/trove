"use client";

import { usePathname } from "next/navigation";

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // No padding on homepage since we hide the navigation
  if (pathname === "/") {
    return <main>{children}</main>;
  }

  return <main className="pb-20 md:pb-0">{children}</main>;
}
