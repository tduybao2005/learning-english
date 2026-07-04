import { AppHeader } from "@/components/AppHeader";

/** Shared layout for every authenticated route (`/dashboard`, `/learn/*`,
 * `/ielts/*`, `/listening/*`, `/settings`): adds the nav header so the
 * listening/IELTS hubs and settings page are reachable from the UI, not just
 * by typing a URL. Auth itself is still enforced per-page via
 * `getSessionUser()` (Task 5/7 pattern) and by `middleware.ts`'s matcher —
 * this layout doesn't duplicate that check, so it stays cheap and can't
 * itself throw on a missing session. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
