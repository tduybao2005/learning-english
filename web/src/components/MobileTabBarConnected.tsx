"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

import { MobileTabBar } from "@/components/MobileTabBar";

/** Keeps the router in the app; the tab bar itself stays presentational. */
export function MobileTabBarConnected() {
  return <MobileTabBar linkComponent={NextLink} activePath={usePathname() ?? ""} />;
}
