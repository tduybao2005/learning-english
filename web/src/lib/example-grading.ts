import { normalize } from "@/lib/grading/normalize";
import { matchAnswer } from "@/lib/grading/match";
import type { LectureExample } from "@/lib/lecture-examples";

export type ExampleCheckResult =
  | { revealed: true; answer: string }
  | { correct: true; matchType: "EXACT" | "VARIANT" | "FUZZY" | "MANUAL"; answer: string }
  | { correct: false };

/**
 * Grade one inline lecture example. FILL_BLANK semantics: exact/variant
 * (contraction) matching only — FILL_BLANK is not fuzzy-eligible in match.ts.
 * The raw answer string leaves the server only on reveal or a correct check.
 */
export function gradeExample(
  example: LectureExample,
  input: string,
  reveal: boolean,
): ExampleCheckResult {
  if (reveal) {
    return { revealed: true, answer: example.answer };
  }
  const result = matchAnswer(input, {
    kind: "FILL_BLANK",
    isOpenEnded: false,
    variants: example.variants.map((v) => ({ normalized: normalize(v) })),
  });
  if (!result.correct) return { correct: false };
  return { correct: true, matchType: result.matchType, answer: example.answer };
}
