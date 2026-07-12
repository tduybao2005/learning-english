/**
 * Inline interactive examples embedded in lecture.md as ```example fences.
 * Pure and Prisma-independent (same pattern as lib/grading/match.ts).
 * Anything crossing the RSC/client boundary must be SafeExample (no answer).
 */

export interface LectureExample {
  id: string;
  prompt: string;
  hint: string;
  answer: string;
  variants: string[];
}

export interface SafeExample {
  id: string;
  prompt: string;
  hint: string;
}

export type LectureSegment =
  | { type: "markdown"; content: string }
  | { type: "example"; example: SafeExample };

// Same defensive strip as MarkdownContent.tsx / scripts/seed/strip-frontmatter.ts.
const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;

// A whole ```example fence: opening fence at line start, non-greedy body,
// closing fence on its own line.
const EXAMPLE_FENCE_RE = /^```example[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;

const REQUIRED_KEYS = ["id", "prompt", "hint", "answer"] as const;
type FieldKey = (typeof REQUIRED_KEYS)[number];

function parseFenceBody(body: string): LectureExample | null {
  const fields: Partial<Record<FieldKey, string>> = {};
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const m = line.match(/^(id|prompt|hint|answer):\s*(.+)$/);
    if (!m) return null; // unknown key or malformed line → soft-fail the block
    fields[m[1] as FieldKey] = m[2].trim();
  }
  for (const key of REQUIRED_KEYS) {
    if (!fields[key]) return null;
  }
  const answer = fields.answer!;
  const variants = answer
    .split("/")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (variants.length === 0) return null;
  return {
    id: fields.id!,
    prompt: fields.prompt!,
    hint: fields.hint!,
    answer,
    variants,
  };
}

/** Full examples including answers. SERVER-SIDE USE ONLY. */
export function parseLectureExamples(lectureMd: string): LectureExample[] {
  const examples: LectureExample[] = [];
  const seen = new Set<string>();
  const md = lectureMd.replace(FRONT_MATTER_RE, "");
  for (const match of md.matchAll(EXAMPLE_FENCE_RE)) {
    const example = parseFenceBody(match[1]);
    if (example && !seen.has(example.id)) {
      seen.add(example.id);
      examples.push(example);
    }
  }
  return examples;
}

/**
 * Split a lecture into renderable segments: markdown chunks interleaved with
 * answer-free SafeExamples. Frontmatter is stripped here, so chunks must be
 * rendered with <MarkdownContent stripFrontmatter={false}> — a mid-lecture
 * chunk may legitimately begin with a `---` thematic break.
 */
export function splitLectureSegments(lectureMd: string): LectureSegment[] {
  const md = lectureMd.replace(FRONT_MATTER_RE, "");
  const segments: LectureSegment[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  for (const match of md.matchAll(EXAMPLE_FENCE_RE)) {
    const example = parseFenceBody(match[1]);
    if (!example || seen.has(example.id)) continue; // leave fence in markdown
    seen.add(example.id);
    const before = md.slice(cursor, match.index);
    if (before.trim().length > 0) {
      segments.push({ type: "markdown", content: before });
    }
    segments.push({
      type: "example",
      example: { id: example.id, prompt: example.prompt, hint: example.hint },
    });
    cursor = match.index! + match[0].length;
  }
  const tail = md.slice(cursor);
  if (tail.trim().length > 0 || segments.length === 0) {
    segments.push({ type: "markdown", content: tail });
  }
  return segments;
}
