export interface TocEntry {
  id: string;
  text: string;
}

/**
 * URL-safe anchor slug for a heading (Vietnamese diacritics stripped, đ→d).
 * Shared by MarkdownContent (id= on each <h2>) and the lecture TOC so anchors
 * always agree. Duplicate headings collide on one id — acceptable for lecture
 * content, which doesn't repeat section titles.
 */
export function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extracts `## ` (H2) headings from markdown, skipping fenced code blocks
 * and stripping inline `*_\`` markers, in document order. */
export function extractToc(md: string): TocEntry[] {
  const entries: TocEntry[] = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      const text = m[1].replace(/[*_`]/g, "").trim();
      entries.push({ id: slugifyHeading(text), text });
    }
  }
  return entries;
}
