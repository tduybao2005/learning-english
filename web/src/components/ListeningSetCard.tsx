import { cn } from "@/lib/utils";

/** One listening set in the hub list. Presentational: `linkComponent` is
 * injected (NextLink in the app, "a" in a design) — no default, because a
 * forgotten prop would silently cost client-side navigation. */
export function ListeningSetCard({
  href,
  title,
  questionCount,
  durationLabel,
  linkComponent: Link,
  className,
}: {
  href: string;
  title: string;
  questionCount: number;
  /** Pre-formatted, e.g. "8:20". Omit to hide. */
  durationLabel?: string;
  linkComponent: React.ElementType;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "press-tile flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:bg-muted/50 active:bg-muted",
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
        🎧
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-caption text-muted-foreground">
          {questionCount} câu{durationLabel ? ` · ${durationLabel}` : ""}
        </p>
      </div>
    </Link>
  );
}
