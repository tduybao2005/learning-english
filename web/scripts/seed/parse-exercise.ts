import { normalize } from "../../src/lib/grading/normalize";

/**
 * exercise.md parser (pure — no I/O).
 *
 * Turns a lesson's `exercise.md` into a structured tree of sections /
 * questions / answer-variants that a later task wires into the DB. It is the
 * highest-risk parser in the pipeline because the real curriculum uses several
 * incompatible conventions; the strategy below is documented inline where it
 * deviates from the plan's idealized example.
 *
 * Corpus realities handled (verified against all 52 exercise.md files):
 *  - Question markers appear as bare `1.`, bold `**A1.**`, and heading `### F1.`.
 *  - Section labels are usually A–G but one speaking lesson uses `## SECTION 1`.
 *  - Answer keys use `1.`, `**A1.**`, and sub-lettered `**C5a.** / **C5b.**`
 *    (two model answers for one question).
 *  - The key boundary must be found FIRST: phase-3 passive_voice repeats
 *    `## SECTION A`.. headings inside the key, and a trailing
 *    `## TỪ VỰNG BÀI TẬP — ĐÁP ÁN` block must not leak into Section F's answers.
 *  - 7 writing/speaking lessons have no answer key at all → fully open-ended.
 */

export type QuestionKind =
  | "FILL_BLANK"
  | "MULTIPLE_CHOICE"
  | "TRANSFORMATION"
  | "ERROR_CORRECTION"
  | "TRANSLATION"
  | "OPEN_WRITING";

export interface ParsedVariant {
  text: string;
  normalized: string;
}

export interface ParsedQuestion {
  number: number;
  prompt: string;
  options: { label: string; text: string }[] | null;
  answerRaw: string;
  keyNote: string | null;
  isOpenEnded: boolean;
  variants: ParsedVariant[];
}

export interface ParsedSection {
  label: string;
  title: string;
  kind: QuestionKind;
  instructions: string | null;
  questions: ParsedQuestion[];
}

export interface ParsedExercise {
  title: string;
  sections: ParsedSection[];
  /** Non-interface diagnostics used by validate.ts (ingest.ts ignores it). */
  diagnostics: {
    keyFound: boolean;
    /** NON-open key answers that matched no body question. */
    unmatchedAnswers: string[];
  };
}

// ---------------------------------------------------------------------------
// Shared regexes / helpers
// ---------------------------------------------------------------------------

// A line-leading question/answer marker: optional heading hashes, optional
// bold/italic stars, an optional single letter, digits, an optional sub-letter
// (C5a/C5b), then a `.`/`)` delimiter followed by whitespace, a `*`, or EOL.
const MARKER_SRC =
  "^(?:#{1,6}[ \\t]+)?(?:\\*{1,3}[ \\t]*)?([A-Za-z]?)(\\d+)([a-z]?)[.)](?=[ \\t*]|$)";

// "SECTION A" is the common form; ~11 real lessons instead use the
// Vietnamese synonym "PHẦN A" (and a couple use numeric "PHẦN 1").
const SECTION_HEAD =
  /^(#{1,6})[ \t]+(?:SECTION|PH[ẦA]N)[ \t]+([A-Za-z0-9]+)[ \t]*[:.\-—)]?[ \t]*(.*)$/i;

// One IELTS-reading lesson (phase_5 lesson_05) has no SECTION/PHẦN heading at
// all — its "sections" are named "QUESTIONS 1–7: TRUE/FALSE/NOT GIVEN" etc.
// These headings carry no letter, so findSectionHeadings assigns sequential
// A/B/C labels to them (both in the body pass and the independent key pass,
// which uses the matching "### Questions 1–7: ..." heading style — the two
// passes stay in sync because both walk the doc in the same order).
const QUESTIONS_HEAD =
  /^(#{1,6})[ \t]+QUESTIONS?[ \t]+(\d+)(?:[–\-−][ \t]*\d+)?[ \t]*[:.\-—)]?[ \t]*(.*)$/i;

// NOTE: earlier version anchored with `\b(?:ANSWER KEY|ĐÁP ÁN)\b`. JS's `\b`
// is defined over ASCII `\w` only, so it does NOT see a boundary between a
// space and "Đ" (a non-ASCII letter that `\w` doesn't recognize) — the
// `\bĐÁP ÁN\b` alternative therefore silently never matched, and 2 real
// lessons (phase_4 lesson_09/10, whose key heading is "## ĐÁP ÁN VÀ NHẬN XÉT"
// / "## ĐÁP ÁN ĐẦY ĐỦ" with no "ANSWER KEY" text) had their entire file
// treated as body — turning every "### SECTION X — Đáp án" key sub-heading
// into a bogus *second* body section. Dropping `\b` fixes both.
const KEY_BOUNDARY = /^#{1,4}[ \t]*[^\n]*(?:ANSWER KEY|ĐÁP ÁN)/im;

function stripMd(s: string): string {
  return s
    .replace(/[*`]/g, "")
    .replace(/[✓✗❌→]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mkVariant(text: string): ParsedVariant {
  return { text: text.trim(), normalized: normalize(text) };
}

function dedupeVariants(vs: ParsedVariant[]): ParsedVariant[] {
  const seen = new Set<string>();
  const out: ParsedVariant[] = [];
  for (const v of vs) {
    if (!v.text || !v.normalized) continue;
    if (seen.has(v.normalized)) continue;
    seen.add(v.normalized);
    out.push(v);
  }
  return out;
}

/** Remove a `(...)` alternate, returning the paren-stripped canonical form. */
function stripParen(text: string): string {
  return text
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Heading / block splitting
// ---------------------------------------------------------------------------

interface HeadingRef {
  level: number;
  index: number;
  end: number;
  label: string; // section label if this is a SECTION heading, else ""
  rest: string; // trailing heading text
  isSection: boolean;
}

function findSectionHeadings(md: string): HeadingRef[] {
  const out: HeadingRef[] = [];
  const re = /^#{1,6}[ \t]+.*$/gm;
  let m: RegExpExecArray | null;
  let autoIdx = 0;
  while ((m = re.exec(md))) {
    const line = m[0];
    const level = (line.match(/^#+/) as RegExpMatchArray)[0].length;
    const sec = line.match(SECTION_HEAD);
    if (sec) {
      out.push({
        level,
        index: m.index,
        end: re.lastIndex,
        label: sec[2].toUpperCase(),
        rest: sec[3].trim(),
        isSection: true,
      });
      continue;
    }
    const q = line.match(QUESTIONS_HEAD);
    if (q) {
      out.push({
        level,
        index: m.index,
        end: re.lastIndex,
        label: String.fromCharCode(65 + autoIdx++),
        rest: q[3].trim(),
        isSection: true,
      });
      continue;
    }
    out.push({ level, index: m.index, end: re.lastIndex, label: "", rest: "", isSection: false });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kind inference
// ---------------------------------------------------------------------------

// Options are usually "- A) ..." but a few lessons (phase_4 lesson_07) use
// lowercase "a) b) c) d)" instead — accept both cases.
function hasOptions(body: string): boolean {
  return /^[ \t]*-?[ \t]*[A-Da-d][.)][ \t]+\S/m.test(body);
}

function inferKind(title: string, body: string): QuestionKind {
  const t = title.toUpperCase();
  // "COMPLET" (not "COMPLETE") deliberately catches both "COMPLETE" and
  // "COMPLETION" ("SENTENCE COMPLETION" is a real IELTS section title whose
  // suffix doesn't contain the substring "COMPLETE").
  if (/\bFILL\b|COMPLET|ĐIỀN|GAP/.test(t)) return "FILL_BLANK";
  // NOTE: the exclusion list here (and the ERROR_CORRECTION trigger below)
  // deliberately does NOT include a bare "CORRECT" — real error-correction
  // sections are consistently titled with "ERROR CORRECTION" / "SỬA LỖI" in
  // this corpus, while "CORRECT" alone shows up constantly as an ordinary
  // adjective in otherwise-unrelated titles ("Choose the CORRECT idiom",
  // "Fill in... with the CORRECT form", "Complete with CORRECT preposition").
  // Treating bare "CORRECT" as an ERROR_CORRECTION signal misclassified
  // "SECTION A: CHOOSE THE CORRECT IDIOM" (a real MULTIPLE_CHOICE section)
  // as ERROR_CORRECTION, and separately excluded it from ever reaching the
  // MULTIPLE_CHOICE branch below.
  if ((/MULTIPLE\s*CHOICE|CHOOSE|TRẮC NGHIỆM/.test(t) || hasOptions(body)) &&
      !/TRANSFORM|REWRITE|ERROR|SỬA LỖI|TRANSLAT|WRITING/.test(t) &&
      hasOptions(body))
    return "MULTIPLE_CHOICE";
  if (/TRANSFORM|REWRITE|COMBINE|CHUYỂN ĐỔI|VIẾT LẠI/.test(t)) return "TRANSFORMATION";
  if (/ERROR|SỬA LỖI/.test(t)) return "ERROR_CORRECTION";
  if (/TRANSLAT|DỊCH/.test(t)) return "TRANSLATION";
  if (/WRITING|FREE\b|ĐOẠN VĂN|PARAGRAPH|ESSAY|SPEAKING|VIẾT/.test(t)) return "OPEN_WRITING";
  if (hasOptions(body)) return "MULTIPLE_CHOICE";
  if (/_{3,}/.test(body)) return "FILL_BLANK";
  return "OPEN_WRITING";
}

// ---------------------------------------------------------------------------
// Question / answer marker splitting inside a block
// ---------------------------------------------------------------------------

interface RawItem {
  number: number;
  label: string; // "A1" / "16" (base label, sub-letter dropped)
  raw: string;
}

/**
 * Some answer keys pack every answer for a section onto ONE physical line.
 * `splitMarkedItems` only recognizes markers at the start of a line, so — for
 * KEY blocks only, where this compression actually occurs — insert a newline
 * before each marker-looking token so the packed line becomes one answer per
 * line. Three separator styles are observed in the real corpus:
 *   - 2+ spaces:  `1. set up  2. give up  3. broke down ...` (phase_2 les_09)
 *   - a pipe:     `1. some (...) | 2. an (...) | ...`        (phase_1 les_06)
 *   - 1 space with NO space after the punctuation, tight against the answer:
 *     `1.reading 2.to become 3.painting ...`                 (phase_3 les_06)
 * The marker itself may carry an optional leading section letter (`D1.`,
 * `D2.`, phase_4 lesson_01 Section D's `D1. ... | D2. ... | D3. ...`), so the
 * lookahead allows `[A-Za-z]?` before the digits, not just bare digits.
 */
function unpackKeyLine(block: string): string {
  return block
    .replace(/(?:[ \t]{2,}|[ \t]*\|[ \t]*)(?=[A-Za-z]?\d+[a-z]?[.)])/g, "\n")
    // NOTE: kept intentionally narrow (period only, then a LETTER with no
    // space) — every real single-space/no-trailing-space case in the corpus
    // is bare digits immediately followed by the next word ("1.reading
    // 2.to become"). Two broader variants were tried and both regressed real
    // lessons: allowing a leading letter misread "...+ being + V3)*" (V3 =
    // third verb form, a grammar aside) as a packed marker "V3)"; allowing
    // ")" as the terminator misread "*(Loại 1)*" / "*(Loại 2)*" (Vietnamese
    // "Type 1/2" conditional-type asides) as packed markers "1)"/"2)". Both
    // false positives created a bogus unconsumed key answer.
    .replace(/(?<=\S) (?=\d+[a-z]?\.[A-Za-z])/g, "\n")
    // A single space also separates markers when the PRECEDING answer ends
    // in its own parenthetical aside, e.g. phase_4 lesson_05 Section D:
    // "...6. to receive (active; she does the receiving) 7. being treated" —
    // only one space survives between the closing ")" and "7.". Anchored to a
    // literal ")" immediately before the space (not just "any non-space
    // char") because the broader version regressed a real lesson: ordinary
    // prose like "...at the age of 89. *(non-defining)*" also has a single
    // space before a digit+period, and misreading "89" as a marker created a
    // bogus unconsumed key answer.
    .replace(/(?<=\)) (?=\d+[a-z]?[.)][ \t])/g, "\n")
    // Ensure a space follows the marker punctuation so the shared MARKER_SRC
    // (which requires whitespace/star/EOL right after "N." or "N)") matches
    // even when the source had no space at all ("1.reading").
    .replace(/^([A-Za-z]?\d+[a-z]?[.)])(?=\S)/gm, "$1 ")
    // A "matching" answer key (phase_3 lesson_12 Section D: "1-B, 2-C, 3-D,
    // 4-J, ...") uses "N-X" pairs instead of "N. X". Rewrite each pair onto
    // its own line so the shared marker splitter picks it up. Gated on 3+
    // occurrences in the same block so an incidental single hyphenated
    // number ("a 24-hour service") in ordinary prose is never misread.
    .replace(/(\d+)[ \t]*-[ \t]*([A-Za-z0-9]+)/g, (whole, num, ans, _off, full: string) => {
      const count = (full.match(/\d+[ \t]*-[ \t]*[A-Za-z0-9]+/g) || []).length;
      return count >= 3 ? `\n${num}. ${ans}` : whole;
    });
}

/**
 * A few answer keys (phase_3 lesson_04, phase_4 lesson_09/10) use a markdown
 * TABLE instead of marker lines: `| A1 | **who** | người — chủ ngữ |`. Rewrite
 * each such row into `**A1.** <answer>` so it flows through the normal
 * marker-based splitter. Which cell holds "the answer" depends on kind: for
 * short-answer kinds (FILL_BLANK/MULTIPLE_CHOICE) the bolded cell is the
 * answer and a trailing "explanation" column is noise; for full-sentence
 * kinds (TRANSFORMATION/ERROR_CORRECTION/etc) the LAST cell holds the
 * complete corrected/target sentence and any earlier cells are metadata
 * (e.g. "Non-defining" / "Cần thêm").
 */
function tableRowsToMarkers(block: string, kind: QuestionKind): string {
  return block.replace(
    /^\|[ \t]*([A-Za-z]{0,2}\d+[a-z]?)[ \t]*\|(.+)\|[ \t]*$/gm,
    (_m, label: string, rest: string) => {
      const cells = rest
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length === 0) return _m;
      const last = cells[cells.length - 1];
      let answer: string;
      if (kind === "FILL_BLANK" || kind === "MULTIPLE_CHOICE") {
        const boldCell = cells.find((c) => /\*\*[^*]+\*\*/.test(c));
        answer = boldCell || last;
      } else {
        answer = last;
      }
      return `**${label}.** ${answer}`;
    }
  );
}

// A handful of answer keys (phase_2 lesson_09/10, phase_3 lesson_05/06/12,
// phase_4 lesson_04/05/08) name each section with a stand-alone BOLD line
// (`**Section A:**`) instead of an actual `#`-heading. Detected separately
// from findSectionHeadings (which only looks at `#` lines) and merged in by
// document position when parsing the key.
// Trailing "(sample answers)" / "(gợi ý)" must be captured into `rest` (not
// discarded) so the `open` heuristic below can still see it.
//
// NOTE: deliberately NOT anchored with a trailing `$` — most of these bold
// markers stand alone on their own line ("**Section A:**\n1. ...\n2. ..."),
// but phase_3 lesson_12 Section D packs the whole answer onto the SAME
// physical line as the marker ("**Section D:** 1-B, 2-C, 3-D, ..."). An
// end-of-line anchor would silently fail to match that line at all — with no
// `end` boundary computed, the block's content is invisible to the parser —
// so this only matches the marker *prefix*; whatever follows on the same
// line becomes the first slice of that section's block content.
const BOLD_SECTION_LINE =
  /^\*{1,2}[ \t]*Section[ \t]+([A-Za-z0-9]+)[ \t]*(\([^)]*\))?[ \t]*:?[ \t]*\*{0,2}[ \t]*/im;

function findKeySectionMarks(keyMd: string): HeadingRef[] {
  const fromHeadings = findSectionHeadings(keyMd).filter((h) => h.isSection);
  const bold: HeadingRef[] = [];
  const re = new RegExp(BOLD_SECTION_LINE.source, "gim");
  let m: RegExpExecArray | null;
  while ((m = re.exec(keyMd))) {
    bold.push({
      level: 99, // synthetic — always the innermost/last-closing boundary
      index: m.index,
      end: re.lastIndex,
      label: m[1].toUpperCase(),
      rest: m[2] || "",
      isSection: true,
    });
  }
  return [...fromHeadings, ...bold].sort((a, b) => a.index - b.index);
}

function splitMarkedItems(block: string): RawItem[] {
  const re = new RegExp(MARKER_SRC, "gm");
  const marks: { idx: number; end: number; number: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const letter = (m[1] || "").toUpperCase();
    const digits = m[2];
    marks.push({
      idx: m.index,
      end: re.lastIndex,
      number: parseInt(digits, 10),
      label: letter + digits,
    });
  }
  const items: RawItem[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].end;
    const stop = i + 1 < marks.length ? marks[i + 1].idx : block.length;
    let raw = block.slice(start, stop);
    raw = raw.replace(/^\**[ \t]*/, ""); // drop closing bold stars / leading ws
    items.push({ number: marks[i].number, label: marks[i].label, raw });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Replace filled-in blanks ("______cooks______") with a clean "______".
 *
 * A FILLED blank has its answer word/phrase directly abutting the underscore
 * markers on both sides (no whitespace touching either underscore run) — e.g.
 * "______does not______" (internal space is fine, boundary chars are not
 * whitespace). An UNFILLED multi-blank prompt like "____________ (be) she
 * ____________ (come)" instead has a space/parenthesis touching each marker.
 * Without the lookaround boundary check, a naive `_{2,}[^_\n]*_{2,}` greedily
 * pairs ANY two nearby underscore runs — including two genuinely separate
 * blanks on one line — and wrongly collapses them into a single blank
 * (verified against lesson_02 Q13, a real two-separate-blanks case).
 */
function normalizeBlanks(s: string): string {
  return s
    .replace(/_{2,}(?=\S)[^_\n]*?(?<=\S)_{2,}/g, "______")
    .replace(/_{3,}/g, "______");
}

function buildPrompt(raw: string, kind: QuestionKind): {
  prompt: string;
  options: { label: string; text: string }[] | null;
} {
  let text = raw;
  let options: { label: string; text: string }[] | null = null;

  if (kind === "MULTIPLE_CHOICE") {
    options = [];
    // Label case is normalized to uppercase — phase_4 lesson_07 uses
    // lowercase "a) b) c) d)" while every other MCQ lesson uses "A) B) C) D)".
    const optRe = /^[ \t]*-?[ \t]*([A-Da-d])[.)][ \t]+(.+?)[ \t]*$/gm;
    let om: RegExpExecArray | null;
    while ((om = optRe.exec(text))) {
      options.push({ label: om[1].toUpperCase(), text: om[2].trim() });
    }
    if (options.length === 0) options = null;
    text = text.replace(/^[ \t]*-?[ \t]*[A-Da-d][.)][ \t]+.*$/gm, "");
  }

  // Drop full-line bold sub-headings like "**A2 — Câu phủ định**".
  text = text.replace(/^[ \t]*\*\*[A-Za-z][0-9]?[ \t]*[—\-(:].*\*\*[ \t]*$/gm, "");

  const prompt = normalizeBlanks(text)
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();

  return { prompt, options };
}

// ---------------------------------------------------------------------------
// Variant extraction (per kind)
// ---------------------------------------------------------------------------

function variantsMultipleChoice(
  answers: string[],
  options: { label: string; text: string }[] | null
): { variants: ParsedVariant[]; keyNote: string | null } {
  const first = answers[0] || "";
  const variants: ParsedVariant[] = [];
  let keyNote: string | null = null;

  const letterM = first.match(/^\s*\**\s*([A-Da-d])\b/);
  if (letterM) {
    const L = letterM[1].toUpperCase();
    variants.push(mkVariant(L));
    const opt = options?.find((o) => o.label === L);
    if (opt) variants.push(mkVariant(stripMd(opt.text)));
  }
  const paren = first.match(/\(([^)]*)\)/);
  if (paren) keyNote = stripMd(paren[1]) || null;
  if (variants.length === 0 && first.trim()) variants.push(mkVariant(stripMd(first)));

  return { variants: dedupeVariants(variants), keyNote };
}

function variantsErrorCorrection(
  answers: string[]
): { variants: ParsedVariant[]; keyNote: string | null } {
  const variants: ParsedVariant[] = [];
  let keyNote: string | null = null;

  for (const a of answers) {
    const line = a.split("\n")[0];
    // Quote form:  "goes" → **go** (full corrected sentence)
    //
    // NOTE: an earlier version used a single regex with a lazy capture group
    // followed by an OPTIONAL parenthetical — `([^*(→\n]+?)\**\s*(?:\(...\))?`
    // — but because the trailing group is optional, the lazy quantifier is
    // satisfied by the SHORTEST possible match (a single character, e.g. "g"
    // instead of "go" for lesson_01 Q34: `"goes" → **go** (Does your brother
    // go to school by bus?)`). Splitting the bold token and the parenthetical
    // into two independent matches avoids that trap.
    const qm = a.match(/"([^"]+)"\s*→\s*([\s\S]*)$/);
    if (qm) {
      const rest = qm[2];
      const paren = rest.match(/\(([^)]*)\)/);
      const bold = rest.match(/\*\*([^*]+)\*\*/);
      if (bold) {
        variants.push(mkVariant(stripMd(bold[1])));
      } else {
        const before = paren ? rest.slice(0, paren.index) : rest;
        const w = stripMd(before);
        if (w) variants.push(mkVariant(w));
      }
      if (paren) {
        keyNote = keyNote || stripMd(paren[1]);
        variants.push(mkVariant(stripMd(paren[1])));
      }
      continue;
    }
    // Arrow form:  ❌ was write → ✓ was **written**
    if (a.includes("→")) {
      const parts = a.replace(/\n/g, " ").split("→");
      let corr = parts[parts.length - 1];
      const pn = corr.match(/\(([^)]*)\)\s*$/);
      if (pn) {
        keyNote = keyNote || stripMd(pn[1]);
        corr = corr.replace(/\([^)]*\)\s*$/, "");
      }
      const bold = corr.match(/\*\*([^*]+)\*\*/);
      if (bold) variants.push(mkVariant(stripMd(bold[1])));
      const whole = stripMd(corr);
      if (whole) variants.push(mkVariant(whole));
      continue;
    }
    const w = stripMd(line);
    if (w) variants.push(mkVariant(w));
  }
  return { variants: dedupeVariants(variants), keyNote };
}

function variantsFillBlank(
  answers: string[],
  blankCount: number
): ParsedVariant[] {
  const raw = stripMd(answers.join(" / ")).replace(/\s*\/\s*/g, " / ");
  let variants: ParsedVariant[];
  if (blankCount >= 2) {
    // Slash joins the per-blank answers → they form ONE ordered answer.
    variants = [mkVariant(raw)];
  } else {
    // Slash separates alternate acceptable answers → split them.
    variants = raw
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(mkVariant);
  }
  // Also accept the paren-stripped canonical form of each (e.g. contractions).
  const extra: ParsedVariant[] = [];
  for (const v of variants) {
    const s = stripParen(v.text);
    if (s && s !== v.text) extra.push(mkVariant(s));
  }
  return dedupeVariants([...variants, ...extra]);
}

function variantsRewrite(answers: string[]): ParsedVariant[] {
  const variants: ParsedVariant[] = [];
  for (const a of answers) {
    const stripped = stripMd(a.split("\n")[0]);
    if (!stripped) continue;
    variants.push(mkVariant(stripped));
    const bare = stripParen(stripped);
    if (bare && bare !== stripped) variants.push(mkVariant(bare));
  }
  return dedupeVariants(variants);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function parseExercise(
  md: string,
  overrides?: Record<string, QuestionKind>
): ParsedExercise {
  const src = md.replace(/\r\n/g, "\n");

  const titleM = src.match(/^#[ \t]+(.+)$/m);
  const title = titleM ? titleM[1].trim() : "";

  // 1. Split body / key at the first ANSWER KEY / ĐÁP ÁN heading.
  const keyM = src.match(KEY_BOUNDARY);
  const keyFound = !!keyM;
  const boundary = keyM ? keyM.index! : src.length;
  const bodyMd = src.slice(0, boundary);
  const keyMd = keyFound ? src.slice(boundary) : "";

  // 2. Parse body sections.
  const bodyHeads = findSectionHeadings(bodyMd).filter((h) => h.isSection);
  const bodySections = bodyHeads.map((h, i) => {
    const start = h.end;
    const stop = i + 1 < bodyHeads.length ? bodyHeads[i + 1].index : bodyMd.length;
    return { label: h.label, title: h.rest, body: bodyMd.slice(start, stop) };
  });

  // 3. Locate key section blocks (bounded by the next marker of level <= own
  //    level so a trailing "## TỪ VỰNG" block cannot leak into the last
  //    section, while inner "### F1." sub-headings stay inside their
  //    section). Markers are either real `#` headings or, in ~8 lessons, a
  //    stand-alone bold line. Item-splitting is deferred to step 4 below,
  //    once each section's `kind` is known (a markdown-table answer key needs
  //    kind to know which cell holds the actual answer).
  const keyMarks = findKeySectionMarks(keyMd);
  interface KeySection {
    label: string;
    open: boolean;
    rawBlock: string;
  }
  const keySections = new Map<string, KeySection>();
  for (let i = 0; i < keyMarks.length; i++) {
    const h = keyMarks[i];
    let stop = keyMd.length;
    for (let j = i + 1; j < keyMarks.length; j++) {
      if (keyMarks[j].level <= h.level) {
        stop = keyMarks[j].index;
        break;
      }
    }
    const rawBlock = unpackKeyLine(keyMd.slice(h.end, stop));
    const open = /sample|gợi ý|gợi y|suggest/i.test(h.rest);
    // Keep the first occurrence of a section letter if repeated.
    if (!keySections.has(h.label)) {
      keySections.set(h.label, { label: h.label, open, rawBlock });
    }
  }

  function resolveAnswers(keySec: KeySection | undefined, kind: QuestionKind): Map<string, string[]> {
    const answers = new Map<string, string[]>();
    if (!keySec) return answers;
    const block = tableRowsToMarkers(keySec.rawBlock, kind);
    for (const item of splitMarkedItems(block)) {
      const list = answers.get(item.label) || [];
      list.push(item.raw.trim());
      answers.set(item.label, list);
    }
    return answers;
  }

  const unmatchedAnswers: string[] = [];
  // Running counter so a section with no detected item markers (see below)
  // still gets a question number that continues the exercise's own sequence.
  let runningNumber = 0;

  // 4. Assemble sections + questions.
  const sections: ParsedSection[] = bodySections.map((bs) => {
    const overrideKind = overrides?.[bs.label];
    const kind = overrideKind || inferKind(bs.title, bs.body);
    const keySec = keySections.get(bs.label);
    const sectionOpen =
      !keyFound || kind === "OPEN_WRITING" || (keySec?.open ?? false);
    const keyAnswers = resolveAnswers(keySec, kind);

    // phase_2 lesson_05 Section D is a dialogue with inline "(37)___" blanks
    // (never at line-start, so the normal marker regex can't see them) and
    // its OWN answer key embedded right in the body as a bold "**Đáp án:**"
    // line — there is no matching entry in the master "## ĐÁP ÁN" section at
    // all. Split that trailing embedded key off before marker-detection so
    // it (a) doesn't get misread as a bogus single question numbered "37" by
    // splitMarkedItems, and (b) is still available as the answer text for
    // the zero-item fallback immediately below.
    const embeddedKeyM = bs.body.match(/\*\*(?:Đáp án|Answer)s?:?\*\*[ \t]*\n?([\s\S]*)$/i);
    const bodyForItems = embeddedKeyM ? bs.body.slice(0, embeddedKeyM.index) : bs.body;
    const embeddedAnswerRaw = embeddedKeyM ? embeddedKeyM[1].trim() : "";

    const items = splitMarkedItems(bodyForItems);

    // Some sections are a single free-response task with no numbered
    // sub-items at all: a paragraph-rewrite prompt (phase_3 lesson_09
    // Section C), a matching-table task (phase_4 lesson_07 Section B), or a
    // "Writing Task" essay prompt (very common as the last section). None of
    // these are atomistically auto-gradable, so — rather than reporting a
    // 0-question section (a real parser gap for numbered drills) — treat the
    // whole section body as ONE open-ended question. This only fires when NO
    // marker was found at all; a section with real numbered items always
    // takes the normal per-item path below.
    if (items.length === 0) {
      const bodyText = bodyForItems.trim();
      if (!bodyText) {
        return { label: bs.label, title: bs.title, kind, instructions: null, questions: [] };
      }
      const { prompt } = buildPrompt(bodyText, kind);
      const answerRaw =
        [...keyAnswers.values()].flat().join("\n").trim() || embeddedAnswerRaw;
      runningNumber += 1;
      const question: ParsedQuestion = {
        number: runningNumber,
        prompt,
        options: null,
        answerRaw,
        keyNote: null,
        isOpenEnded: true,
        variants: answerRaw ? [mkVariant(stripMd(answerRaw))] : [],
      };
      return { label: bs.label, title: bs.title, kind, instructions: null, questions: [question] };
    }
    // Instructions: preamble before the first question marker.
    let instructions: string | null = null;
    if (items.length > 0) {
      const firstIdx = bs.body.indexOf(items[0].raw);
      const pre = bs.body.slice(0, firstIdx >= 0 ? firstIdx : 0);
      const cleaned = pre
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^\*\*[A-Za-z][0-9]?[ \t]*[—\-(:]/.test(l))
        .join(" ")
        .replace(/^\*+|\*+$/g, "")
        .trim();
      instructions = cleaned || null;
    }

    const consumed = new Set<string>();
    const questions: ParsedQuestion[] = [];
    const seenNumbers = new Set<number>();

    for (const it of items) {
      if (seenNumbers.has(it.number)) continue; // guard @@unique(sectionId,number)
      seenNumbers.add(it.number);
      runningNumber = Math.max(runningNumber, it.number);

      const { prompt, options } = buildPrompt(it.raw, kind);
      const answers = keyAnswers.get(it.label) || [];
      if (answers.length > 0) consumed.add(it.label);
      const answerRaw = answers.join("\n").trim();

      let variants: ParsedVariant[] = [];
      let keyNote: string | null = null;

      if (sectionOpen) {
        if (answerRaw) variants = [mkVariant(stripMd(answerRaw))];
      } else if (answers.length > 0) {
        if (kind === "MULTIPLE_CHOICE") {
          const r = variantsMultipleChoice(answers, options);
          variants = r.variants;
          keyNote = r.keyNote;
        } else if (kind === "ERROR_CORRECTION") {
          const r = variantsErrorCorrection(answers);
          variants = r.variants;
          keyNote = r.keyNote;
        } else if (kind === "FILL_BLANK") {
          const blanks = (prompt.match(/______/g) || []).length;
          // Isolate the first line of each answer: a few key formats (IELTS
          // reading answer keys) follow the short answer with a multi-line
          // "Justification: ..." paragraph that must not leak into the
          // variant text.
          variants = variantsFillBlank(answers.map((a) => a.split("\n")[0]), blanks);
        } else {
          variants = variantsRewrite(answers);
        }
        if (variants.length === 0) variants = [mkVariant(stripMd(answerRaw))];
      }

      questions.push({
        number: it.number,
        prompt,
        options,
        answerRaw,
        keyNote,
        isOpenEnded: sectionOpen,
        variants: dedupeVariants(variants),
      });
    }

    // Any non-open key answers we never matched to a question → unmatched.
    if (keySec && !sectionOpen) {
      for (const label of keyAnswers.keys()) {
        if (!consumed.has(label)) unmatchedAnswers.push(label);
      }
    }

    return { label: bs.label, title: bs.title, kind, instructions, questions };
  });

  return {
    title,
    sections,
    diagnostics: { keyFound, unmatchedAnswers },
  };
}
