import { Home, BookOpen, Headphones, GraduationCap, Settings } from "lucide-react";
import type { ComponentType, ElementType } from "react";

import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Extra routes this tab owns, on top of its own href. `/exams` owns
   * `/ielts` because IELTS lives under the exams hub conceptually. */
  alsoOwns?: readonly string[];
};

/** Labels mirror `AppSidebar`'s nav exactly — the two navs are the same
 * information architecture at two viewports. */
const TABS: readonly Tab[] = [
  { href: "/dashboard", label: "Lộ trình", icon: Home },
  { href: "/vocab", label: "Từ vựng", icon: BookOpen },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/exams", label: "Đề thi", icon: GraduationCap, alsoOwns: ["/ielts"] },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

const owns = (path: string, route: string) =>
  path === route || path.startsWith(`${route}/`);

/** App-wide bottom tab bar for phones/tablets (<1024px) — the primary mobile
 * navigation, replacing the link row that used to live in `AppHeader`. Fixed to
 * the viewport bottom, so `(app)/layout.tsx` reserves `pb-16 lg:pb-0` on
 * `<main>`. Hidden at `lg:`, where `AppSidebar` takes over.
 *
 * Presentational: `linkComponent` and `activePath` are injected (see
 * `MobileTabBarConnected`), so it renders outside a Next runtime. */
export function MobileTabBar({
  linkComponent: Link,
  activePath,
  className,
}: {
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: ElementType;
  /** Current pathname. A tab owns the route when the path equals or nests under its href. */
  activePath: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden",
        className,
      )}
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, alsoOwns }) => {
          const active = [href, ...(alsoOwns ?? [])].some((route) => owns(activePath, route));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 text-caption font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {/* 5 tabs at 375px = 75px each; without nowrap "Luyện nghe"
                  wraps to two lines and the row loses its baseline. */}
              <span className="whitespace-nowrap text-[0.6875rem] tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
