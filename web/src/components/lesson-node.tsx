import { cn } from "@/lib/utils";

export type LessonNodeState = "COMPLETED" | "UNLOCKED" | "LOCKED" | "SKIPPED";

const NODE_META: Record<
  LessonNodeState,
  { icon: string; pill: string; badge: string; label: string; clickable: boolean }
> = {
  COMPLETED: {
    icon: "✓",
    pill: "border-success/40 bg-success-bg",
    badge: "bg-success text-success-foreground",
    label: "text-foreground",
    clickable: true,
  },
  UNLOCKED: {
    icon: "▶",
    pill: "border-primary bg-primary shadow-primary-glow",
    badge: "bg-white text-primary",
    label: "text-primary-foreground",
    clickable: true,
  },
  SKIPPED: {
    icon: "⏭",
    pill: "border-dashed border-border bg-card",
    badge: "bg-muted text-muted-foreground",
    label: "text-muted-foreground",
    clickable: true,
  },
  LOCKED: {
    icon: "🔒",
    pill: "border-border bg-muted cursor-not-allowed",
    badge: "bg-muted-foreground/25 text-muted-foreground",
    label: "text-muted-foreground",
    clickable: false,
  },
};

/**
 * Shared 4-state lesson node (done / unlocked / locked / skipped): a pill
 * with a leading state icon-circle (design doc §05 "node dạng viên thuốc").
 * Used across the dashboard timeline and any other lesson listing.
 */
export function LessonNode({
  state,
  label,
  href,
  title,
  className,
  linkComponent: Link,
}: {
  state: LessonNodeState;
  label: string;
  href?: string;
  title?: string;
  className?: string;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  const meta = NODE_META[state];
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
          meta.badge,
        )}
      >
        {meta.icon}
      </span>
      <span className={cn("text-sm font-semibold", meta.label)}>{label}</span>
    </>
  );

  const pillClassName = cn(
    "inline-flex min-h-11 items-center gap-[11px] rounded-full border px-[18px] py-2.5 transition-transform",
    meta.pill,
    className,
  );

  if (!meta.clickable || !href) {
    return (
      <span className={pillClassName} title={title}>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={cn(pillClassName, "hover:scale-[1.02]")} title={title}>
      {content}
    </Link>
  );
}
