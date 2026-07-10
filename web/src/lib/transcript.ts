/**
 * Per-section transcript splitting for the sectioned listening runner.
 *
 * PRACTICE transcripts follow the authoring convention (enforced by
 * scripts/seed/check-listening.ts) that every section opens with a narrator
 * line "NARRATOR: Section N. ..." — those lines are the split points.
 * Returns null when the transcript doesn't split cleanly into `sectionCount`
 * chunks (no markers, wrong count, out-of-order numbering — e.g. TOEIC
 * "Part N" transcripts), so callers fall back to whole-transcript gating.
 * Outro lines ("NARRATOR: That is the end of Section N.") don't match the
 * marker pattern and stay inside their own section's chunk.
 */
const SECTION_MARKER_RE = /^NARRATOR:\s*Section\s+(\d+)\b/;

export function transcriptChunksForSections(
  transcriptMd: string,
  sectionCount: number,
): string[] | null {
  if (sectionCount <= 0) return null;

  const lines = transcriptMd.split("\n");
  const markers: { line: number; num: number }[] = [];
  lines.forEach((text, i) => {
    const m = text.match(SECTION_MARKER_RE);
    if (m) markers.push({ line: i, num: Number.parseInt(m[1], 10) });
  });

  if (markers.length !== sectionCount) return null;
  if (markers.some((m, i) => m.num !== i + 1)) return null;

  return markers.map((marker, i) => {
    const start = i === 0 ? 0 : marker.line; // preamble before marker 1 joins chunk 0
    const end = i + 1 < markers.length ? markers[i + 1].line : lines.length;
    return lines.slice(start, end).join("\n").trim();
  });
}
