import { describe, it, expect } from "vitest";

import {
  rawToBand,
  placementBand,
  startLessonFor,
  scaleRawScore,
  STANDARD_BAND_TABLE_TOTAL,
  type BandTableRow,
} from "./band";

// The real table seeded from `ielts_practice_tests/test_01/answer_key.md`'s
// "Bảng Quy Đổi Điểm — Reading Band Score" table (used for both reading and
// listening raw->band lookups per `PlacementTest.bandTable`'s schema
// comment). Raw ranges: 13–14->4.5, 15–18->5.0, 19–22->5.5, 23–26->6.0,
// 27–29->6.5, 30–32->7.0, 33–34->7.5, 35–36->8.0, 37–38->8.5, 39–40->9.0.
const TABLE: BandTableRow[] = [
  { min: 13, band: 4.5 },
  { min: 15, band: 5.0 },
  { min: 19, band: 5.5 },
  { min: 23, band: 6.0 },
  { min: 27, band: 6.5 },
  { min: 30, band: 7.0 },
  { min: 33, band: 7.5 },
  { min: 35, band: 8.0 },
  { min: 37, band: 8.5 },
  { min: 39, band: 9.0 },
];

describe("rawToBand", () => {
  it("maps a raw score to the band whose range it falls into", () => {
    expect(rawToBand(14, TABLE)).toBe(4.5); // top of the 13-14 range
    expect(rawToBand(18, TABLE)).toBe(5.0); // top of the 15-18 range
    expect(rawToBand(26, TABLE)).toBe(6.0); // top of the 23-26 range
  });

  it("maps the exact lower-bound raw score of each range (table-edge case)", () => {
    expect(rawToBand(13, TABLE)).toBe(4.5);
    expect(rawToBand(15, TABLE)).toBe(5.0);
    expect(rawToBand(23, TABLE)).toBe(6.0);
    expect(rawToBand(39, TABLE)).toBe(9.0);
  });

  it("caps at the highest band for a raw score above the table's top range", () => {
    // Table tops out at 39-40 -> 9.0; a raw score of 41 shouldn't be possible
    // in a real 40-question test, but the function should never throw or
    // return a nonsensical value for an out-of-range input.
    expect(rawToBand(40, TABLE)).toBe(9.0);
    expect(rawToBand(100, TABLE)).toBe(9.0);
  });

  it("returns 0 (a safe 'below measurable range' floor) for a raw score below the lowest table min", () => {
    // Decision: this table (taken directly from the source material) has no
    // data below raw=13/band=4.5 (real IELTS conversion charts continue down
    // to band 1.0, but this course's source table is truncated there).
    // Rather than guess an extrapolated sub-4.5 band with no source data,
    // rawToBand returns 0 for any raw score below the table's lowest `min`.
    // This is still "safe" for downstream use: placementBand's rounding and
    // startLessonFor's phase-mapping both treat 0 as "far below 3.5", so it
    // still routes a very-low scorer to phase_1 (the easiest phase) rather
    // than crashing or silently fabricating a band number that isn't backed
    // by any source data.
    expect(rawToBand(12, TABLE)).toBe(0);
    expect(rawToBand(0, TABLE)).toBe(0);
  });

  it("throws on an empty band table rather than silently returning a wrong answer", () => {
    expect(() => rawToBand(20, [])).toThrow();
  });
});

describe("placementBand", () => {
  it("is the mean of the reading and listening bands when both land on the same band", () => {
    // raw 24 and 25 both fall in the 23-26 -> 6.0 range.
    expect(placementBand(24, 25, TABLE)).toBe(6.0);
  });

  it("rounds a mean ending in .0 or .5 to itself (already on a half-band boundary)", () => {
    // reading raw 26 -> 6.0, listening raw 27 -> 6.5. Mean = 6.25... wait,
    // (6.0 + 6.5) / 2 = 6.25 - covered by the boundary test below instead.
    // Here: reading 26->6.0, listening 26->6.0 => mean 6.0 (no rounding needed).
    expect(placementBand(26, 26, TABLE)).toBe(6.0);
    // reading 30->7.0, listening 33->7.5 => mean 7.25, see boundary test below
    // for the .25 case; this case picks two raw scores whose bands average
    // to an exact .5 multiple: reading 23->6.0, listening 30->7.0 => 6.5.
    expect(placementBand(23, 30, TABLE)).toBe(6.5);
  });

  it("rounds a .25 mean UP to the next half-band (matches real IELTS overall-band rounding convention)", () => {
    // reading raw 26 -> band 6.0; listening raw 27 -> band 6.5.
    // mean = (6.0 + 6.5) / 2 = 6.25 -> rounds up to 6.5, per the documented
    // decision: IELTS's own published rounding rule rounds .25 up to the
    // next half band and .75 up to the next whole band (not down, and not
    // to "nearest even" or similar). This is the explicit boundary case the
    // task brief asked to verify.
    expect(placementBand(26, 27, TABLE)).toBe(6.5);
  });

  it("rounds a .75 mean UP to the next whole band", () => {
    // reading raw 26 -> 6.0; listening raw 30 -> 7.0. mean = 6.5 (not .75,
    // pick a genuine .75 case instead): reading 27->6.5, listening 30->7.0
    // => mean 6.75 -> rounds up to 7.0.
    expect(placementBand(27, 30, TABLE)).toBe(7.0);
  });
});

describe("scaleRawScore", () => {
  // Found via E2E verification: the source `bandTable` is calibrated for a
  // standard 40-question IELTS section (its lowest populated row is
  // min=13/band=4.5). This placement test intentionally uses shorter
  // sections (26 reading questions, 10 listening questions) to keep the
  // test brief. Without scaling, a listening score of 8/10 (80% correct —
  // a strong result) never reaches the table's lowest threshold of 13 and
  // silently floors at band 0 via `rawToBand`'s "below lowest min" rule.
  // `scaleRawScore` fixes this by projecting a raw score onto a
  // 40-question-equivalent scale before it's ever passed to `rawToBand`.
  it("scales a raw score proportionally onto the standard 40-question total", () => {
    expect(scaleRawScore(26, 26, 40)).toBe(40); // perfect score on a 26-question section -> perfect on the 40 scale
    expect(scaleRawScore(0, 10, 40)).toBe(0);
    expect(scaleRawScore(5, 10, 40)).toBe(20); // 50% of 10 -> 50% of 40
  });

  it("reproduces the real bug found in E2E verification and confirms the fix", () => {
    // Before this fix: rawToBand(8, TABLE) === 0 (8 < the table's lowest
    // min of 13) even though 8/10 is a strong (80%) listening score.
    expect(rawToBand(8, TABLE)).toBe(0);
    // After scaling 8/10 onto the 40-question scale (8/10 * 40 = 32), it
    // lands in the 30-32 -> 7.0 range: a realistic band for 80% correct.
    const scaled = scaleRawScore(8, 10, 40);
    expect(scaled).toBe(32);
    expect(rawToBand(scaled, TABLE)).toBe(7.0);
  });

  it("rounds to the nearest whole raw score on the standard scale", () => {
    // 20/26 * 40 = 30.76... -> rounds to 31.
    expect(scaleRawScore(20, 26, 40)).toBe(31);
  });

  it("clamps to [0, standardTotal] and returns 0 for a zero/invalid total", () => {
    expect(scaleRawScore(0, 0, 40)).toBe(0); // no questions in the section at all
    expect(scaleRawScore(10, 10, 40)).toBe(40); // exactly full marks, no overshoot
  });

  it("defaults standardTotal to STANDARD_BAND_TABLE_TOTAL (40) when omitted", () => {
    expect(scaleRawScore(26, 26)).toBe(STANDARD_BAND_TABLE_TOTAL);
  });
});

describe("startLessonFor", () => {
  it("maps the defined boundary values from the brief", () => {
    expect(startLessonFor(3.0)).toEqual({ phaseSlug: "phase_1_foundation" });
    expect(startLessonFor(3.5)).toEqual({ phaseSlug: "phase_2_elementary" });
    expect(startLessonFor(4.5)).toEqual({ phaseSlug: "phase_2_elementary" });
    expect(startLessonFor(5.0)).toEqual({ phaseSlug: "phase_3_intermediate" });
    expect(startLessonFor(5.5)).toEqual({ phaseSlug: "phase_3_intermediate" });
    expect(startLessonFor(6.0)).toEqual({ phaseSlug: "phase_4_advanced" });
    expect(startLessonFor(6.5)).toEqual({ phaseSlug: "phase_4_advanced" });
    expect(startLessonFor(7.0)).toEqual({ phaseSlug: "phase_5_ielts_prep" });
    expect(startLessonFor(9.0)).toEqual({ phaseSlug: "phase_5_ielts_prep" });
  });

  it("just below the <3.5 boundary stays phase_1, just below 3.5 is the last phase_1 value", () => {
    expect(startLessonFor(0)).toEqual({ phaseSlug: "phase_1_foundation" });
    expect(startLessonFor(3.49)).toEqual({ phaseSlug: "phase_1_foundation" });
  });

  it("decision: an unlisted gap value (4.5-5.0, 5.5-6.0, 6.5-7.0) falls back to the PRECEDING (easier) phase", () => {
    // The brief's ranges have gaps: (4.5, 5.0), (5.5, 6.0), (6.5, 7.0) are
    // never produced by placementBand (which always rounds to a multiple of
    // 0.5, and every 0.5 step IS covered by some bucket) — but startLessonFor
    // is tested defensively in case it's ever called directly with a raw,
    // un-rounded band. Decision: round DOWN to the nearest defined lower
    // phase boundary rather than jumping the learner ahead into a harder
    // phase they may not be ready for. A learner mistakenly placed one phase
        // too easy just repeats slightly-too-simple material for a lesson or
    // two before naturally advancing; placed one phase too hard, they could
    // get stuck and discouraged. This is documented explicitly since it's a
    // real design choice, not an oversight.
    expect(startLessonFor(4.75)).toEqual({ phaseSlug: "phase_2_elementary" });
    expect(startLessonFor(5.75)).toEqual({ phaseSlug: "phase_3_intermediate" });
    expect(startLessonFor(6.75)).toEqual({ phaseSlug: "phase_4_advanced" });
  });
});
