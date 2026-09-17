import NextLink from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { AppSidebarConnected } from "@/components/AppSidebarConnected";
import { MobileTabBarConnected } from "@/components/MobileTabBarConnected";
import { getSessionUser } from "@/lib/auth/session";

/** Shared layout for every authenticated route (`/dashboard`, `/learn/*`,
 * `/ielts/*`, `/listening/*`, `/settings`). Navigation is split by viewport:
 * `AppSidebar` at `lg:`, `MobileTabBar` below it, with `AppHeader` reduced to
 * the brand. Sign-out is deliberately in neither — it lives on the settings
 * page, which both navs link to. Redirects unauthenticated requests to
 * `/login`, and brand-new Google users who haven't completed onboarding to
 * `/onboarding/name`. Async because the sidebar's profile card
 * (name/email/band) needs the session user. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.goalType === null) redirect("/onboarding/name");

  return (
    <div className="flex min-h-screen flex-col">
      <AppSidebarConnected name={user?.name ?? null} email={user?.email ?? ""} band={user?.placementBand ?? null} />
      <AppHeader className="lg:hidden" linkComponent={NextLink} />
      <main className="flex-1 pb-16 lg:pb-0 lg:pl-[232px]">{children}</main>
      <MobileTabBarConnected />
    </div>
  );
}
