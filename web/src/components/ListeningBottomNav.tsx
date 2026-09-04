import type { ElementType } from "react";

/**
 * Fixed, compact bottom bar for the listening set page — the page's only back
 * affordance (the old foot link and the by-title one are gone). `fixed` escapes
 * the `<main lg:pl-[232px]>` frame, so the sidebar offset is re-applied here.
 * Below `lg` it sits at `bottom-16`, stacked directly ABOVE the app-wide
 * `MobileTabBar` (h-16); at `lg:` the tab bar is gone and it drops to
 * `bottom-0`. The page must reserve bottom padding clearing both bars so the
 * last question isn't hidden behind them.
 */
export function ListeningBottomNav({
  linkComponent: Link,
  subtitle,
}: {
  linkComponent: ElementType;
  subtitle?: string;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-card/95 backdrop-blur lg:bottom-0 lg:pl-[232px]">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/listening"
          className="press-btn inline-flex items-center gap-1 whitespace-nowrap text-caption font-medium text-muted-foreground transition-all hover:text-foreground"
        >
          ← Quay lại danh sách bài nghe
        </Link>
        {/* The set title would wrap the 48px-tall bar onto two lines on a phone;
            the back link is the only thing that has to be there. */}
        {subtitle && (
          <span className="hidden truncate text-caption text-muted-foreground sm:inline">
            {subtitle}
          </span>
        )}
      </div>
    </nav>
  );
}
