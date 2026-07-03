/**
 * Canonicalize a string for answer matching and variant storage.
 *
 * Task 8 (grading) will extend this file with `match()`; this task only needs
 * the deterministic normalization used both to build AnswerVariant.normalized
 * at ingest time and to compare a learner's submission at grade time.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}
