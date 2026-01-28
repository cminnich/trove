"use client";

import { usePathname } from "next/navigation";
import { DesktopNav } from "./DesktopNav";
import { BottomTabBar } from "./BottomTabBar";

export function NavigationWrapper() {
  const pathname = usePathname();

  // Hide navigation on homepage
  if (pathname === "/") {
    return null;
  }

  return (
    <>
      <DesktopNav />
      <BottomTabBar />
    </>
  );
}
