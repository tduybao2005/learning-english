"use client";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { resultTier } from "@/components/vocab/games";

export interface SummaryStat {
  label: string;
  value: string;
}

/** Bán kính vòng tiến độ; chu vi suy ra từ đây và truyền vào CSS qua `--ring-c`. */
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const TIER_META = {
  excellent: { label: "Xuất sắc", ring: "text-success", chip: "bg-success-bg text-success" },
  good: { label: "Tốt", ring: "text-primary", chip: "bg-primary/10 text-primary" },
  review: { label: "Cần ôn lại", ring: "text-streak", chip: "bg-streak-bg text-streak-foreground" },
} as const;

/**
 * Màn hình kết thúc dùng chung cho cả ba game từ vựng (thẻ ghi nhớ, quiz,
 * ghép cặp) — trước đây mỗi game tự dựng một bản gần giống nhau.
 *
 * Chỉ vòng tròn tiến độ được hoạt hoạ (CSS thuần); các con số render thẳng
 * giá trị cuối để test không phụ thuộc thời gian và để `prefers-reduced-motion`
 * không làm mất thông tin.
 */
export function SessionSummary({
  title,
  correct,
  total,
  extraStats = [],
  saveState,
  restartLabel,
  onRestart,
  backHref,
  backLabel = "Quay lại từ vựng",
  linkComponent: Link,
}: {
  title: string;
  correct: number;
  total: number;
  extraStats?: SummaryStat[];
  saveState: "idle" | "saving" | "saved" | "error";
  restartLabel: string;
  onRestart: () => void;
  backHref: string;
  backLabel?: string;
  /** Truyền `NextLink` trong app, `"a"` trong test/design. */
  linkComponent: React.ElementType;
}) {
  const tier = TIER_META[resultTier(correct, total)];
  const ratio = total > 0 ? correct / total : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - ratio);

  return (
    <div className="animate-summary-in flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <h2 className="text-h2 font-bold">{title}</h2>

      <div className="relative size-32">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="10"
            className="stroke-muted"
          />
          <circle
            cx="60"
            cy="60"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={cn("animate-ring-fill stroke-current", tier.ring)}
            style={
              {
                "--ring-c": `${RING_CIRCUMFERENCE}`,
                strokeDasharray: RING_CIRCUMFERENCE,
                strokeDashoffset: dashOffset,
              } as React.CSSProperties
            }
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span data-testid="summary-correct" className="text-h1 font-extrabold leading-none">
            {correct}
          </span>
          <span data-testid="summary-total" className="text-caption text-muted-foreground">
            / {total}
          </span>
        </div>
      </div>

      <span className={cn("rounded-full px-3 py-1 text-caption font-bold", tier.chip)}>
        {tier.label}
      </span>

      {extraStats.length > 0 && (
        <dl className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {extraStats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{stat.label}</dt>
              <dd className="text-lg font-bold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {saveState === "saving" && "Đang lưu tiến độ..."}
        {saveState === "saved" && "Đã lưu tiến độ."}
        {saveState === "error" && (
          <span className="text-destructive">
            Không thể lưu tiến độ. Vui lòng kiểm tra kết nối và thử lại.
          </span>
        )}
      </p>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
        <Button variant="outline" onClick={onRestart}>
          {restartLabel}
        </Button>
        <Link href={backHref} className={cn(buttonVariants({ variant: "accent" }))}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
