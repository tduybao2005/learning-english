import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Encouraging empty state (design doc §12): soft icon tile, headline,
 * supporting copy, optional CTA. */
export function EmptyState({
  icon = "🌱",
  title,
  description,
  ctaHref,
  ctaLabel,
  linkComponent: Link,
}: {
  icon?: string;
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span aria-hidden className="flex size-24 items-center justify-center rounded-3xl bg-secondary text-5xl">
        {icon}
      </span>
      <h2 className="text-h2 font-extrabold">{title}</h2>
      {description ? (
        <p className="max-w-xs text-body text-muted-foreground">{description}</p>
      ) : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className={cn(buttonVariants(), "mt-2")}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
