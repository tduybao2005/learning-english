import NextLink from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { AppSidebarConnected } from "@/components/AppSidebarConnected";
import { LogoutButton } from "@/components/LogoutButton";
import { getSessionUser } from "@/lib/auth/session";

/** Shared layout for every authenticated route (`/dashboard`, `/learn/*`,
 * `/ielts/*`, `/listening/*`, `/settings`): adds the nav header so the
 * listening/IELTS hubs and settings page are reachable from the UI, not just
 * by typing a URL. Redirects unauthenticated requests to `/login`, and
 * brand-new Google users who haven't completed onboarding to
 * `/onboarding/name`. Async because the sidebar's profile card
 * (name/email/band) needs the session user. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.goalType === null) redirect("/onboarding/name");

  return (
    <div className="flex min-h-screen flex-col">
      <AppSidebarConnected name={user?.name ?? null} email={user?.email ?? ""} band={user?.placementBand ?? null} />
      <AppHeader
        className="lg:hidden"
        linkComponent={NextLink}
        logoutSlot={<LogoutButton variant="ghost" />}
      />
      <main className="flex-1 lg:pl-[232px]">{children}</main>
    </div>
  );
}
