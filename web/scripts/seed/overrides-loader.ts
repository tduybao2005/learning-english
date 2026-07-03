import fs from "fs";
import path from "path";
import type { QuestionKind } from "./parse-exercise";

/**
 * Loads `overrides.json` — the escape hatch for section kinds `inferKind()`
 * genuinely can't resolve from title/body alone. Shared by `validate.ts` and
 * `ingest.ts` so both see the same overrides applied the same way.
 */
export function loadOverrides(): Record<string, QuestionKind> {
  const p = path.join(__dirname, "overrides.json");
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Narrows the flat `"lessonSlug.SECTION": kind` map to one lesson's overrides. */
export function scopedOverrides(
  all: Record<string, QuestionKind>,
  lessonSlug: string
): Record<string, QuestionKind> {
  const out: Record<string, QuestionKind> = {};
  const prefix = `${lessonSlug}.`;
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  }
  return out;
}
