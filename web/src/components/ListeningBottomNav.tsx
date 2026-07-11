import type { ElementType } from "react";

/**
 * Fixed, compact bottom bar for the listening set page — the page's only back
 * affordance (the old foot link and the by-title one are gone). `fixed` escapes
 * the `<main lg:pl-[232px]>` frame, so the sidebar offset is re-applied here.
 * The page must reserve matching bottom padding so the last question isn't
 * hidden behind it.
 */
export function ListeningBottomNav({
  linkComponent: Link,
  subtitle,
}: {
  linkComponent: ElementType;
  subtitle?: string;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:pl-[232px]">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-6">
        <Link
          href="/listening"
          className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground"
        >
          ← Quay lại danh sách bài nghe
        </Link>
        {subtitle && <span className="text-caption text-muted-foreground">{subtitle}</span>}
      </div>
    </nav>
  );
}
