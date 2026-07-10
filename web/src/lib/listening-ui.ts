import type { CefrLevel } from "@prisma/client";

export const LEVEL_ORDER: CefrLevel[] = ["A2", "B1", "B2", "C1"];

/** Vietnamese labels + badge styling per CEFR level (semantic tokens only,
 * so dark mode works untouched). */
export const LEVEL_META: Record<CefrLevel, { labelVi: string; badgeClass: string }> = {
  A2: { labelVi: "Sơ cấp", badgeClass: "bg-success-bg text-success" },
  B1: { labelVi: "Trung cấp", badgeClass: "bg-primary/10 text-primary" },
  B2: { labelVi: "Trung cao cấp", badgeClass: "bg-accent/15 text-accent" },
  C1: { labelVi: "Cao cấp", badgeClass: "bg-destructive/10 text-destructive" },
};
