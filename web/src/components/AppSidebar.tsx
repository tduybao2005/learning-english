import { Home, Headphones, GraduationCap, BookOpen, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/learn", label: "Lộ trình", icon: Home },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/exams", label: "Đề thi", icon: GraduationCap },
  { href: "/vocab", label: "Từ vựng", icon: BookOpen },
] as const;

/** Fixed left sidebar for the ≥1024px desktop shell (design doc §13): logo,
 * vertical nav, a profile card pinned at the bottom that links to
 * `/settings` (where logout actually lives). Hidden below `lg:`, where
 * `AppHeader`'s horizontal nav is the only nav surface — the two never render
 * at the same time. `name`/`email`/`band` are passed down from the (async)
 * layout server component since session lookup can't happen here.
 *
 * Presentational: the active route arrives as a plain string and links are
 * injected, so this renders unchanged outside a Next runtime (design-system
 * previews). `AppSidebarConnected` is the wrapper that reads `usePathname()`.
 * `linkComponent` has no default on purpose — see `AppHeader`. */
export function AppSidebar({
  name,
  email,
  band,
  pathname,
  linkComponent: Link,
}: {
  name: string | null;
  email: string;
  band: number | null;
  /** Current route, e.g. `/listening/practice_a2_02`. Drives nav highlighting. */
  pathname: string;
  /** Pass `NextLink` in the app; `"a"` anywhere without a router. Required. */
  linkComponent: React.ElementType;
}) {
  const displayName = name ?? email;
  const avatarLetter = (displayName || "?").charAt(0).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-[232px] flex-col border-r border-border bg-card lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          H
        </span>
        <span className="text-sm font-bold tracking-tight">Học tiếng Anh</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "press-btn flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          className="press-tile group flex items-center gap-3 rounded-xl border border-transparent bg-muted p-3 transition-all hover:border-primary hover:bg-secondary"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
          >
            {avatarLetter}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {band != null ? `Band ${band.toFixed(1)}` : "Chưa xếp hạng"}
            </span>
          </span>
          <Settings className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>
    </aside>
  );
}
