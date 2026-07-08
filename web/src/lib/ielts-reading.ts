export type ReadingPair = { passageMd: string; questionsMd: string };

/**
 * Splits an IELTS reading.md into (passage, questions) column pairs using its
 * H2 skeleton: `## READING PASSAGE n` followed by `## QUESTIONS x–y`. The
 * files are hand-written, so any test that doesn't follow the skeleton gets
 * `null` and the caller renders the original single-column markdown instead.
 */
export function splitReadingSections(
  md: string,
): { intro: string; pairs: ReadingPair[] } | null {
  const matches = [...md.matchAll(/^## +(.+)$/gm)].map((m) => ({
    index: m.index!,
    title: m[1].trim(),
  }));
  if (matches.length === 0) return null;

  const sections = matches.map((m, i) => ({
    title: m.title,
    body: md.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : md.length).trim(),
  }));

  const pairs: ReadingPair[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    if (/^reading passage/i.test(sections[i].title) && /^questions/i.test(sections[i + 1].title)) {
      pairs.push({ passageMd: sections[i].body, questionsMd: sections[i + 1].body });
    }
  }
  if (pairs.length === 0) return null;

  return { intro: md.slice(0, matches[0].index).trim(), pairs };
}
