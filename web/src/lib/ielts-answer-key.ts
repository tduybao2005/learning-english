export type IeltsSkill = "reading" | "writing" | "speaking";

/**
 * Cuts an IELTS answer_key.md down to one skill's section: from the first
 * H1-H3 heading containing the skill word to the next heading of the same or
 * shallower depth. Answer keys are hand-written, so when no heading matches,
 * return the whole key rather than nothing.
 */
export function sliceAnswerKeyBySkill(md: string, skill: IeltsSkill): string {
  const headingRe = /^(#{1,3})\s+(.+)$/gm;
  const headings = [...md.matchAll(headingRe)].map((m) => ({
    index: m.index!,
    depth: m[1].length,
    text: m[2].toLowerCase(),
  }));
  const start = headings.find((h) => h.text.includes(skill));
  if (!start) return md;
  const end = headings.find((h) => h.index > start.index && h.depth <= start.depth);
  return md.slice(start.index, end ? end.index : md.length).trim();
}
