import type { CefrLevel } from "@prisma/client";

import { LEVEL_META } from "@/lib/listening-ui";
import { cn } from "@/lib/utils";

/** CEFR pill: level code plus its Vietnamese label. Colours come from
 * LEVEL_META (semantic tokens only), so dark mode needs no extra work. */
export function LevelBadge({ level, className }: { level: CefrLevel; className?: string }) {
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-bold",
        meta.badgeClass,
        className,
      )}
    >
      {level} · {meta.labelVi}
    </span>
  );
}
