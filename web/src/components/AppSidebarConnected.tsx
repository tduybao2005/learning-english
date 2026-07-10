"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/AppSidebar";

/** Router-aware wrapper around the presentational `AppSidebar`.
 *
 * `usePathname()` needs Next's router context, which only exists inside the
 * app. Keeping it here — rather than inside `AppSidebar` — is what lets the
 * sidebar ship to the design system and be unit-tested without a router. */
export function AppSidebarConnected(props: {
  name: string | null;
  email: string;
  band: number | null;
}) {
  return <AppSidebar {...props} pathname={usePathname() ?? ""} linkComponent={NextLink} />;
}
