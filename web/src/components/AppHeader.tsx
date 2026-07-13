import { cn } from "@/lib/utils";

/** Slim top bar for every authenticated `(app)` route on phones/tablets:
 * brand + sign-out, nothing else. Navigation moved to `MobileTabBar`, the
 * fixed bottom tab bar — so this header no longer carries a link row. Confined
 * to `lg:hidden` by the `(app)` layout, where `AppSidebar` takes over.
 *
 * Presentational: the link component and sign-out are injected, so this renders
 * unchanged outside a Next runtime (design-system previews). `linkComponent`
 * has no default on purpose — omitting it would silently downgrade the logo
 * link to a full page load, which no test or build would catch. */
export function AppHeader({
  className,
  linkComponent: Link,
  logoutSlot,
}: {
  className?: string;
  /** Pass `NextLink` in the app; `"a"` anywhere without a router. Required. */
  linkComponent: React.ElementType;
  /** Rendered at the far right — the app passes `<LogoutButton variant="ghost" />`. */
  logoutSlot: React.ReactNode;
}) {
  return (
    <header className={cn("sticky top-0 z-10 border-b border-border bg-card", className)}>
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            H
          </span>
          <span className="text-sm font-bold tracking-tight">Học tiếng Anh</span>
        </Link>

        <div className="ml-auto shrink-0 pl-2">{logoutSlot}</div>
      </div>
    </header>
  );
}
