import { Home, Headphones, GraduationCap, Settings } from "lucide-react";
import type { ElementType } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/ielts", label: "IELTS", icon: GraduationCap },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

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
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = activePath === href || activePath.startsWith(`${href}/`);
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
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
