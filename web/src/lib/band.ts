/**
 * Placement-test scoring: raw score -> IELTS band -> starting curriculum phase.
 *
 * Pure (no I/O, no Prisma) — mirrors the pattern already used by
 * `lib/grading/match.ts` and `scripts/seed/parse-exercise.ts`.
 */

/** One row of a raw-score->band conversion table (`PlacementTest.bandTable`). */
export interface BandTableRow {
  min: number;
  band: number;
}

/**
 * Converts a raw score into an IELTS band using a `{min, band}[]` table
 * (each row's `min` is the lower bound of a contiguous raw-score range; the
 * range's upper bound is implicitly "up to the next row's min - 1").
 *
 * Table-edge decisions (documented, not incidental):
 *  - A raw score above the table's highest `min` is capped at that row's
 *    band (never extrapolated upward) — a 40-question reading test can't
 *    score above what the table's top row represents.
 *  - A raw score below the table's LOWEST `min` returns **0**. The source
 *    table (`ielts_practice_tests/test_01/answer_key.md`'s "Bảng Quy Đổi
 *    Điểm") only has data down to raw=13/band=4.5 — real IELTS conversion
 *    charts continue down to band 1.0, but nothing in this course's source
 *    material specifies those lower rows. Rather than fabricate an
 *    extrapolated sub-4.5 band with no source backing, this returns 0 (not
 *    a valid IELTS band, but a safe floor): both `placementBand`'s rounding
 *    and `startLessonFor`'s phase mapping treat anything under 3.5 as
 *    "start at phase_1", so a very-low scorer still lands in the right
 *    (easiest) phase rather than the function throwing or guessing.
 *  - An empty table throws — that's a configuration bug (no seeded
 *    bandTable), not a valid input to silently paper over.
 */
export function rawToBand(raw: number, table: BandTableRow[]): number {
  if (!table || table.length === 0) {
    throw new Error("rawToBand: band table is empty");
  }
  const sorted = [...table].sort((a, b) => a.min - b.min);
  if (raw < sorted[0].min) return 0;

  let band = sorted[0].band;
  for (const row of sorted) {
    if (raw >= row.min) band = row.band;
    else break;
  }
  return band;
}

/** Rounds to the nearest 0.5, rounding .25 up to the next half-band and .75
 * up to the next whole band — this is the real IELTS convention published
 * for combining component scores into an Overall Band (e.g. 6.25 -> 6.5,
 * 6.75 -> 7.0), which `Math.round(x * 2) / 2` implements directly since
 * JS's `Math.round` rounds ties away from zero (toward +Infinity for
 * positive numbers). */
function roundToNearestHalf(x: number): number {
  return Math.round(x * 2) / 2;
}

/**
 * Placement band = the mean of the reading and listening bands (each first
 * converted from its own raw score via the same `table`), rounded to the
 * nearest 0.5 per the IELTS overall-band convention above. Writing is
 * deliberately excluded — writing is graded later by a deferred AI model,
 * never contributes to the immediately-computed placement band.
 */
export function placementBand(reading: number, listening: number, table: BandTableRow[]): number {
  const readingBand = rawToBand(reading, table);
  const listeningBand = rawToBand(listening, table);
  return roundToNearestHalf((readingBand + listeningBand) / 2);
}

/**
 * The reading/listening band table sourced from
 * `ielts_practice_tests/test_01/answer_key.md` is calibrated for a
 * standard 40-question IELTS section (its lowest populated row is
 * min=13/band=4.5, tapering up to min=39/band=9.0). This app's placement
 * test intentionally uses shorter sections than a full IELTS test (26
 * reading questions across 2 passages instead of 3, 10 listening
 * questions instead of 40) to keep it brief.
 */
export const STANDARD_BAND_TABLE_TOTAL = 40;

/**
 * Projects a raw score from a section of `total` questions onto the
 * `standardTotal`-question scale the band table expects, so `rawToBand`
 * sees a comparable raw number regardless of how many questions the
 * actual section had.
 *
 * Found via end-to-end verification of the placement wizard: without this
 * scaling step, a listening score of 8/10 (80% correct — a strong result)
 * is passed to `rawToBand` as literally `8`, which is below the table's
 * lowest populated `min` of 13 and silently floors at band 0 (see
 * `rawToBand`'s "below lowest min" rule) — a materially wrong placement
 * result for a strong listening performance. Scaling 8/10 onto the
 * 40-question scale first (8/10 * 40 = 32) lands it in the table's 30-32
 * -> 7.0 range instead, which is realistic for 80% correct.
 *
 * Returns 0 for a non-positive `total` (a section with no questions at
 * all — a configuration issue, not something to throw on mid-placement).
 */
export function scaleRawScore(
  raw: number,
  total: number,
  standardTotal: number = STANDARD_BAND_TABLE_TOTAL,
): number {
  if (total <= 0) return 0;
  const scaled = Math.round((raw / total) * standardTotal);
  return Math.min(Math.max(scaled, 0), standardTotal);
}

/** One phase slug per `Phase.slug` as seeded by `scripts/seed/parse-lesson.ts`'s `PHASE_META`. */
export type PhaseSlug =
  | "phase_1_foundation"
  | "phase_2_elementary"
  | "phase_3_intermediate"
  | "phase_4_advanced"
  | "phase_5_ielts_prep";

/**
 * Maps a placement band to the phase a learner should start in.
 *
 * Defined boundaries (from the plan): <3.5 -> phase_1; 3.5-4.5 -> phase_2;
 * 5.0-5.5 -> phase_3; 6.0-6.5 -> phase_4; >=7.0 -> phase_5.
 *
 * Decision for the gaps the brief calls out (4.5-5.0, 5.5-6.0, 6.5-7.0):
 * `placementBand` always returns a multiple of 0.5, so every actual output
 * of `placementBand` already lands inside one of the defined ranges above —
 * these gaps are never hit via the normal band.ts pipeline. `startLessonFor`
 * is still tested defensively against gap values (e.g. 4.75) in case it's
 * ever called with a raw, un-rounded number. The chosen behavior: round DOWN
 * to the nearest defined (easier) phase rather than up. Rationale: starting
 * a learner one phase too easy costs them a lesson or two of
 * already-familiar material before they naturally progress; starting them
 * one phase too hard risks stalling them on material they're not ready for.
 * Implemented as a cascade of ascending thresholds, each threshold being the
 * NEXT defined phase's lower bound (so the gap floats down into the
 * preceding phase automatically) rather than an explicit range list.
 */
export function startLessonFor(band: number): { phaseSlug: PhaseSlug } {
  if (band < 3.5) return { phaseSlug: "phase_1_foundation" };
  if (band < 5.0) return { phaseSlug: "phase_2_elementary" };
  if (band < 6.0) return { phaseSlug: "phase_3_intermediate" };
  if (band < 7.0) return { phaseSlug: "phase_4_advanced" };
  return { phaseSlug: "phase_5_ielts_prep" };
}
