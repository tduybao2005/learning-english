import { normalize } from "./normalize";
import { contractionForms } from "./match";

export interface SentenceGrade {
  correct: boolean;
  /** A short Vietnamese hint when the answer is only *minorly* off (missing a
   * capital letter / a final period). `null` for a fully-correct answer OR a
   * genuinely wrong one — the runner shows its generic "Chưa đúng" for those. */
  reason: string | null;
}

/** First alphabetic character, or null if the string has none. */
function firstAlpha(s: string): string | null {
  const m = s.match(/[A-Za-z]/);
  return m ? m[0] : null;
}

/** Trailing sentence-terminating punctuation of a raw string, or null. */
function terminalPunctuation(s: string): string | null {
  const last = s.trim().slice(-1);
  return last === "." || last === "!" || last === "?" ? last : null;
}

/**
 * Strict grading for the "retype the whole corrected sentence" question kinds
 * (TRANSFORMATION, ERROR_CORRECTION), where a single fixed answer exists.
 *
 * Unlike `matchAnswer`'s FUZZY path, this does NOT tolerate typos or wrong
 * words — "He likes spicy foo" must fail against "He likes spicy food." The
 * ONLY slips forgiven-with-a-reason are the two the learner can trivially
 * self-correct: a lowercase first letter and a missing final period. Those
 * still count as WRONG (per product decision) but return a specific reason so
 * the UI can nudge the learner. Contraction-equivalent forms (does not /
 * doesn't) are treated as the same words. Anything else → wrong, reason null.
 */
export function gradeSentence(input: string, canonicals: string[]): SentenceGrade {
  const inputForms = contractionForms(normalize(input));
  let minorReason: string | null = null;

  for (const canonical of canonicals) {
    const canonicalForms = contractionForms(normalize(canonical));
    const sameWords = inputForms.some((f) => f.length > 0 && canonicalForms.includes(f));
    if (!sameWords) continue;

    const issues: string[] = [];
    const inputFirst = firstAlpha(input);
    const canonicalFirst = firstAlpha(canonical);
    if (
      canonicalFirst &&
      canonicalFirst === canonicalFirst.toUpperCase() &&
      inputFirst &&
      inputFirst === inputFirst.toLowerCase()
    ) {
      issues.push("viết hoa chữ cái đầu câu");
    }
    const canonicalEnd = terminalPunctuation(canonical);
    if (canonicalEnd && !input.trim().endsWith(canonicalEnd)) {
      issues.push("dấu chấm câu ở cuối");
    }

    if (issues.length === 0) return { correct: true, reason: null };
    // Same words but a minor slip: remember it, but keep scanning in case
    // another canonical matches with no issues at all.
    if (minorReason === null) {
      minorReason = `Gần đúng rồi! Bạn còn thiếu ${issues.join(" và ")}.`;
    }
  }

  return { correct: false, reason: minorReason };
}
