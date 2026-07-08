import { normalize } from "./normalize";

/**
 * Answer matching for the grading pipeline.
 *
 * Kept Prisma-independent on purpose (mirrors the pattern already used by
 * `web/scripts/seed/parse-exercise.ts`, which defines its own `QuestionKind`
 * string union rather than importing the Prisma-generated type): this module
 * has no DB/runtime dependency and is a pure function of its inputs.
 */
export type QuestionKind =
  | "FILL_BLANK"
  | "MULTIPLE_CHOICE"
  | "TRANSFORMATION"
  | "ERROR_CORRECTION"
  | "TRANSLATION"
  | "OPEN_WRITING";

export type MatchResult =
  | { correct: true; matchType: "EXACT" | "VARIANT" | "FUZZY" | "MANUAL" }
  | { correct: false };

export interface MatchQuestion {
  kind: QuestionKind;
  isOpenEnded: boolean;
  variants: { normalized: string }[];
}

/** Question kinds where the answer is a full sentence, so a small number of
 * character-level slips (a typo, a dropped word ending) shouldn't fail the
 * learner outright — these are the only kinds eligible for fuzzy matching. */
const FUZZY_ELIGIBLE_KINDS: ReadonlySet<QuestionKind> = new Set([
  "TRANSFORMATION",
  "TRANSLATION",
  "ERROR_CORRECTION",
]);

const FUZZY_SIMILARITY_THRESHOLD = 0.85;

/** Minimum normalized-input length for an open-ended answer to count as a
 * genuine attempt worth routing to manual review, rather than a throwaway. */
const MANUAL_REVIEW_MIN_LENGTH = 15;

/**
 * Bidirectional contraction pairs: [full form, contracted form].
 * Applied as whole-word/whole-phrase regex replacements, case-insensitively
 * is unnecessary since `normalize()` already lowercases the input. This list
 * covers the standard set of English auxiliary/negation contractions; it is
 * intentionally not exhaustive of every dialectal or archaic form.
 */
const CONTRACTION_PAIRS: readonly [string, string][] = [
  // Negations
  ["do not", "don't"],
  ["does not", "doesn't"],
  ["did not", "didn't"],
  ["is not", "isn't"],
  ["are not", "aren't"],
  ["was not", "wasn't"],
  ["were not", "weren't"],
  ["has not", "hasn't"],
  ["have not", "haven't"],
  ["had not", "hadn't"],
  ["will not", "won't"],
  ["would not", "wouldn't"],
  ["should not", "shouldn't"],
  ["could not", "couldn't"],
  ["might not", "mightn't"],
  ["must not", "mustn't"],
  ["need not", "needn't"],
  ["shall not", "shan't"],
  ["cannot", "can't"],
  ["can not", "can't"],
  // Pronoun + be/aux
  ["i am", "i'm"],
  ["you are", "you're"],
  ["we are", "we're"],
  ["they are", "they're"],
  ["it is", "it's"],
  ["he is", "he's"],
  ["she is", "she's"],
  ["that is", "that's"],
  ["there is", "there's"],
  ["here is", "here's"],
  ["what is", "what's"],
  ["who is", "who's"],
  ["i will", "i'll"],
  ["you will", "you'll"],
  ["he will", "he'll"],
  ["she will", "she'll"],
  ["we will", "we'll"],
  ["they will", "they'll"],
  ["it will", "it'll"],
  ["i would", "i'd"],
  ["you would", "you'd"],
  ["he would", "he'd"],
  ["she would", "she'd"],
  ["we would", "we'd"],
  ["they would", "they'd"],
  ["i have", "i've"],
  ["you have", "you've"],
  ["we have", "we've"],
  ["they have", "they've"],
  ["let us", "let's"],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace every occurrence of `from` (as a whole phrase, word-boundary
 * delimited) with `to` in `s`. */
function replacePhrase(s: string, from: string, to: string): string {
  const pattern = new RegExp(`\\b${escapeRegExp(from)}\\b`, "g");
  return s.replace(pattern, to);
}

/**
 * Generate the set of contraction-equivalent forms of an already-normalized
 * string: the original, an "all contracted" form, and an "all expanded"
 * form. This is enough to catch single-contraction answers (the common
 * case in this curriculum) whether the learner used the long or short form,
 * without needing to enumerate every combination for multi-contraction
 * sentences.
 */
function contractionForms(normalized: string): string[] {
  let contracted = normalized;
  let expanded = normalized;
  for (const [full, short] of CONTRACTION_PAIRS) {
    contracted = replacePhrase(contracted, full, short);
    expanded = replacePhrase(expanded, short, full);
  }
  return [normalized, contracted, expanded];
}

/** Plain dynamic-programming Levenshtein edit distance (no dependency). */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

export function matchAnswer(input: string, question: MatchQuestion): MatchResult {
  const normalizedInput = normalize(input);

  if (normalizedInput.length === 0) {
    return { correct: false };
  }

  const variantTexts = question.variants.map((v) => v.normalized);

  // EXACT: the normalized input matches a stored variant verbatim.
  if (variantTexts.includes(normalizedInput)) {
    return { correct: true, matchType: "EXACT" };
  }

  // VARIANT: a contraction-equivalent form of the input matches a variant.
  const forms = contractionForms(normalizedInput);
  for (const form of forms) {
    if (form !== normalizedInput && variantTexts.includes(form)) {
      return { correct: true, matchType: "VARIANT" };
    }
  }

  // FUZZY: only for sentence-level kinds, and only if nothing exact matched.
  if (FUZZY_ELIGIBLE_KINDS.has(question.kind)) {
    for (const variantText of variantTexts) {
      if (similarity(normalizedInput, variantText) >= FUZZY_SIMILARITY_THRESHOLD) {
        return { correct: true, matchType: "FUZZY" };
      }
    }
  }

  // ERROR_CORRECTION: the learner retypes the WHOLE corrected sentence, but
  // seeded variants usually hold only the corrected word/phrase. Accept any
  // contraction form of the input that contains a variant as a whole phrase.
  // Reported as VARIANT (Prisma MatchType enum — no migration).
  if (question.kind === "ERROR_CORRECTION") {
    for (const form of forms) {
      for (const variantText of variantTexts) {
        if (
          variantText.length > 0 &&
          new RegExp(`(?:^| )${escapeRegExp(variantText)}(?: |$)`).test(form)
        ) {
          return { correct: true, matchType: "VARIANT" };
        }
      }
    }
  }

  // MANUAL: open-ended question with a substantive attempt, but no
  // automated match was found above.
  if (question.isOpenEnded && normalizedInput.length >= MANUAL_REVIEW_MIN_LENGTH) {
    return { correct: true, matchType: "MANUAL" };
  }

  return { correct: false };
}
