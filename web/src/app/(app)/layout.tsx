import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { getSessionUser } from "@/lib/auth/session";

/** Shared layout for every authenticated route (`/dashboard`, `/learn/*`,
 * `/ielts/*`, `/listening/*`, `/settings`): adds the nav header so the
 * listening/IELTS hubs and settings page are reachable from the UI, not just
 * by typing a URL. Auth itself is still enforced per-page via
 * `getSessionUser()` (Task 5/7 pattern) and by `middleware.ts`'s matcher —
 * this layout doesn't duplicate that check (a null user just gets fallback
 * display props), so it stays cheap and can't itself throw on a missing
 * session. Async because the sidebar's profile card (name/email/band) needs
 * the session user. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      <AppSidebar name={user?.name ?? null} email={user?.email ?? ""} band={user?.placementBand ?? null} />
      <AppHeader className="lg:hidden" />
      <main className="flex-1 lg:pl-64">{children}</main>
    </div>
  );
}
