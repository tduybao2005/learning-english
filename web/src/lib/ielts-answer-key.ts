export type IeltsSkill = "reading" | "writing" | "speaking";

const ALL_SKILLS: IeltsSkill[] = ["reading", "writing", "speaking"];

/**
 * Cuts an IELTS answer_key.md down to one skill's section: from the first
 * H1-H3 heading containing the skill word to the next heading of the same or
 * shallower depth that belongs to a DIFFERENT skill (i.e. its text contains
 * one of the other two skill keywords, but not the current one). Answer keys
 * routinely have multiple consecutive same-depth headings for one skill
 * (e.g. a "## WRITING" section followed by "## Checklist ... Writing", or a
 * "## Bảng Quy Đổi Điểm — Reading Band Score" table after the reading
 * questions) — those must stay INSIDE the slice, so only a heading naming a
 * different skill ends it. Headings that mention the current skill, or
 * mention no skill at all, are included. When no heading matches the skill
 * word at all, return the whole key rather than nothing.
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
  const otherSkills = ALL_SKILLS.filter((s) => s !== skill);
  const end = headings.find(
    (h) =>
      h.index > start.index &&
      h.depth <= start.depth &&
      otherSkills.some((other) => h.text.includes(other))
  );
  return md.slice(start.index, end ? end.index : md.length).trim();
}
