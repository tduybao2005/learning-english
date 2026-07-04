/**
 * Circular progress ring showing "Đã thuộc x/y" (learned/total VocabWords for
 * a lesson). Pure presentational, server-renderable (no client interactivity).
 */
export function StatsRing({ learned, total }: { learned: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((learned / total) * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-24 shrink-0">
        <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
          <circle cx="50" cy="50" r={radius} strokeWidth="8" className="fill-none stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            strokeWidth="8"
            strokeLinecap="round"
            className="fill-none stroke-primary transition-all"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">
          {percent}%
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Đã thuộc{" "}
        <span className="font-medium text-foreground">
          {learned}/{total}
        </span>
      </p>
    </div>
  );
}
