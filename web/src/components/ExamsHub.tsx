import { ChevronRight, GraduationCap, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

/** One exam family on the hub. Adding a third exam is a data change (push a
 * descriptor) rather than a rewrite — that is the point of this shape.
 * `href: null` renders the muted, non-interactive "sắp có" state. */
export type ExamType = {
  /** Stable key, e.g. `"ielts"`. */
  key: string;
  /** Display name, e.g. `"IELTS"`. */
  name: string;
  /** One line under the name, e.g. `"30 đề · đã làm 3"`. */
  subtitle: string;
  /** Longer supporting copy. */
  description: string;
  /** Target route. `null` ⇒ disabled/coming-soon: no link, no href. */
  href: string | null;
  /** Small right-aligned status label, e.g. `"Sắp có"`. Omit when there is none.
   * Not a score: the hub deliberately shows no band. */
  badge?: string | null;
  /** Icon name from the DS set. */
  icon?: "graduation" | "file";
};

const ICONS = { graduation: GraduationCap, file: FileText } as const;

/**
 * The "Đề thi" hub (`/exams`): a vertical list of exam families. IELTS links
 * through to `/ielts`; TOEIC is a disabled placeholder until its routes exist.
 *
 * Presentational: `linkComponent` is injected and has no default — a default of
 * `"a"` would silently downgrade every card to a full page load (see AppHeader).
 */
export function ExamsHub({
  examTypes,
  linkComponent: Link,
  className,
}: {
  examTypes: ExamType[];
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 className="text-h1 font-extrabold">Đề thi</h1>
      <p className="mt-1 text-body text-muted-foreground">
        Chọn loại đề bạn muốn luyện.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {examTypes.map((exam) => {
          const Icon = ICONS[exam.icon ?? "graduation"];
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  exam.href ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-h2 font-bold">{exam.name}</span>
                <span className="block text-caption text-muted-foreground">{exam.subtitle}</span>
                {/* The long line is desktop-only: on a phone the card is a row,
                 * and the subtitle already carries the useful part. */}
                <span className="mt-1 hidden text-body text-muted-foreground lg:block">
                  {exam.description}
                </span>
              </span>
              {exam.badge ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-caption font-semibold",
                    exam.href
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {exam.badge}
                </span>
              ) : null}
              {exam.href ? (
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground lg:hidden"
                />
              ) : null}
            </>
          );

          // Phone/tablet: a centred disclosure row. Desktop (lg:) keeps the
          // shipped top-aligned card exactly as-is.
          const shared =
            "flex min-h-11 w-full items-center gap-4 rounded-2xl border border-border p-4 text-left lg:items-start";

          return (
            <li key={exam.key}>
              {exam.href ? (
                <Link
                  href={exam.href}
                  className={cn(
                    shared,
                    "press-tile bg-card transition-all hover:bg-muted/50 active:bg-muted",
                    "max-lg:border-primary",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div aria-disabled className={cn(shared, "bg-muted/40 opacity-70")}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-caption text-muted-foreground lg:hidden">
        Loại đề mới sẽ được thêm vào đây khi sẵn sàng.
      </p>
    </div>
  );
}
