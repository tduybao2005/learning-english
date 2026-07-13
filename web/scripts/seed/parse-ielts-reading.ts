import { normalize } from "../../src/lib/grading/normalize";

/**
 * IELTS Reading parser (pure — no I/O).
 *
 * Turns one test's `reading.md` + `answer_key.md` into the 40 questions that
 * `seed-ielts.ts` writes as Section / Question / AnswerVariant rows.
 *
 * This is a TypeScript port of `scripts/check_ielts_keys.py` (repo root),
 * which learned the corpus's format quirks the hard way. Do not "simplify"
 * the four defences below without re-running the 30-test corpus:
 *
 *  1. Key tables come in English AND Vietnamese, with the answer in different
 *     columns: `| Q | Answer | Explanation |`, `| Câu | Đáp án | Giải thích |`,
 *     and — the trap — `| Q | Paragraph | Correct Heading | Why |`, where
 *     column 2 is the *paragraph letter* and the answer lives in column 3.
 *     Columns are therefore matched by HEADER NAME, most specific first.
 *  2. Question numbers are sometimes bold (`| **1** |`) → strip markdown from
 *     every cell before asking whether it is a number.
 *  3. Some keys use a numbered list (`1. TRUE`) instead of a table.
 *  4. Group markers are inconsistent — `### Questions 1–5`,
 *     `#### Questions 1–6: True / False / Not Given`,
 *     `**Questions 7–10: Complete the sentences below...**` — and the dash is
 *     an en-dash as often as a hyphen. Match the "Questions a–b" marker
 *     whatever decorates it.
 *
 * Only tables that DECLARE an answer column are read, which is also what keeps
 * the raw-score→band table (`| Số câu đúng | Band IELTS |`) — whose rows look
 * exactly like answer rows — out of the answers.
 *
 * `usable` is a *structural* verdict, the same one the Python gate gives: it
 * means the key answers every question the paper asks, in a form that is legal
 * for the type the paper declares. It does NOT mean the answers are factually
 * right (test_01 Q2 is a legal TFNG value that contradicts the passage). 19 of
 * the 30 tests pass; the other 11 have keys answering questions that do not
 * exist in the paper, and must not be forced through.
 */

/** The Prisma `QuestionKind` values this parser can emit. */
export type IeltsQuestionKind = "MULTIPLE_CHOICE" | "FILL_BLANK";

/** The IELTS task type as declared by reading.md's own instruction prose. */
export type IeltsTaskType =
  | "TFNG"
  | "YNNG"
  | "HEADINGS"
  | "MATCH_PARA"
  | "MCQ"
  | "COMPLETION"
  | "UNKNOWN";

export interface ParsedVariant {
  text: string;
  normalized: string;
}

export interface ParsedOption {
  label: string;
  text: string;
}

export interface ParsedIeltsQuestion {
  number: number;
  prompt: string;
  taskType: IeltsTaskType;
  kind: IeltsQuestionKind;
  /** `null` for FILL_BLANK → the UI renders a text input. */
  options: ParsedOption[] | null;
  /** The key cell exactly as written, kept for the record. */
  answerRaw: string;
  /** From the key table's Explanation column — never generated here. */
  explanation: string | null;
  /** Variants split on `/` (hard rule: all of them are correct). */
  variants: ParsedVariant[];
}

export interface ParsedIeltsReading {
  questions: ParsedIeltsQuestion[];
  /** Empty iff the test is structurally sound. */
  problems: string[];
  usable: boolean;
}

// ---------------------------------------------------------------------------
// Trap 4: group markers
// ---------------------------------------------------------------------------

const GROUP_RE = /^[#*\s]*Questions?\s+(\d+)\s*[–—-]\s*(\d+)/gim;

/** Task-type detection from the group's own instruction prose. Order matters. */
const TASK_PATTERNS: [IeltsTaskType, RegExp][] = [
  ["YNNG", /\bYES\b[\s\S]*\bNO\b[\s\S]*\bNOT GIVEN\b/i],
  ["TFNG", /\bTRUE\b[\s\S]*\bFALSE\b[\s\S]*\bNOT GIVEN\b/i],
  ["HEADINGS", /list of headings|correct heading/i],
  ["MATCH_PARA", /which paragraph|matching (information|features)/i],
  ["MCQ", /choose the correct letter/i],
  [
    "COMPLETION",
    /no more than|complete the (summary|sentences|notes|table)|one word/i,
  ],
];

const ROMAN = /^[ivx]+$/i;
const LETTER = /^[A-J]$/;

/** Is `ans` a legal FORM for a question of type `task`? (mirrors the gate) */
function legalAnswer(task: IeltsTaskType, ans: string): boolean {
  const a = ans.trim().replace(/^\*+|\*+$/g, "").trim();
  if (!a) return false;
  const head = a.split(/\s+/)[0].replace(/\.$/, "");
  switch (task) {
    case "TFNG":
      return ["TRUE", "FALSE", "NOT GIVEN"].includes(a.toUpperCase());
    case "YNNG":
      return ["YES", "NO", "NOT GIVEN"].includes(a.toUpperCase());
    case "HEADINGS":
      return ROMAN.test(head);
    case "MATCH_PARA":
    case "MCQ":
      return LETTER.test(head);
    case "COMPLETION":
      // Free text; the only assertable thing is that it does not belong to
      // another type — that is exactly the test_01 Q14-18 failure mode.
      return !["TRUE", "FALSE", "NOT GIVEN", "YES", "NO"].includes(a.toUpperCase());
    default:
      return true; // unknown type: cannot judge, don't punish
  }
}

function stripMd(s: string): string {
  return s
    .replace(/[*`_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mkVariant(text: string): ParsedVariant {
  return { text: text.trim(), normalized: normalize(text) };
}

// ---------------------------------------------------------------------------
// reading.md — groups, prompts, options
// ---------------------------------------------------------------------------

interface Group {
  lo: number;
  hi: number;
  task: IeltsTaskType;
  body: string;
}

function findGroups(md: string): Group[] {
  const groups: Group[] = [];
  const marks: { lo: number; hi: number; start: number; end: number }[] = [];
  GROUP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GROUP_RE.exec(md))) {
    marks.push({
      lo: parseInt(m[1], 10),
      hi: parseInt(m[2], 10),
      start: m.index,
      end: GROUP_RE.lastIndex,
    });
  }
  for (let i = 0; i < marks.length; i++) {
    const body = md.slice(
      marks[i].end,
      i + 1 < marks.length ? marks[i + 1].start : md.length
    );
    const found = TASK_PATTERNS.find(([, re]) => re.test(body));
    groups.push({
      lo: marks[i].lo,
      hi: marks[i].hi,
      task: found ? found[0] : "UNKNOWN",
      body,
    });
  }
  return groups;
}

// A question item inside a group body: `**1.** text`, `1. text`, `**1)** text`.
const ITEM_RE = /^[ \t]*\*{0,2}(\d{1,2})[.)]\*{0,2}(?=[ \t]|$)/gm;

// A question item written as a TABLE ROW instead — test_14/test_26 lay matching
// -headings questions out as `| Question | Paragraph |` / `| **14** | Paragraph B |`.
const ITEM_ROW_RE = /^[ \t]*\|[ \t]*\*{0,2}(\d{1,2})[.):]?\*{0,2}[ \t]*\|[ \t]*([^|]*?)[ \t]*\|/gm;

// A question item written as an INLINE numbered blank inside a summary
// paragraph. Every decoration in the corpus, all of them real:
//   "heated by **7** ___________"      (test_12)
//   "assert their __(7)__ in the eyes" (test_13)
//   "**(37) \_\_\_\_\_\_**"            (test_29 — escaped underscores)
//   "called **7** .........."           (test_18/test_23 — dotted blanks)
const ITEM_BLANK_RE =
  /\*{0,2}\(?[ \t]*(\d{1,2})[ \t]*\)?\*{0,2}[ \t]*(?:(?:\\?_){2,}|\.{3,})/g;

// The label of an option/heading carries its punctuation INSIDE or OUTSIDE the
// bold markers depending on the test: `- **A** x`, `- **A)** x`, `- A) x`,
// `- **i.** x`, `- i. x`. Both positions must be optional or whole tests parse
// with zero options.
// MCQ options: `- **A)** text`, `**A** text`, `- A) text`, `A. text`.
const OPTION_RE = /^[ \t]*-?[ \t]*\*{0,2}([A-D])[.):]?\*{0,2}[.):]?[ \t]+(.+?)[ \t]*$/gm;

/**
 * The "List of Headings" block, written two ways in the corpus:
 *   - `- i. Putting a price on nature` / `- **i.** Putting a price on nature`
 *   - a two-column table: `| i | Putting a price on nature |`
 */
function parseHeadings(body: string): ParsedOption[] {
  const start = body.search(/list of headings/i);
  const region = start >= 0 ? body.slice(start) : body;
  const out: ParsedOption[] = [];
  const seen = new Set<string>();
  const re =
    /^[ \t]*(?:-[ \t]*\*{0,2}([ivx]+)[.):]?\*{0,2}[.):]?[ \t]+(.+?)|\|[ \t]*\*{0,2}([ivx]+)[.):]?\*{0,2}[ \t]*\|[ \t]*(.+?)[ \t]*\|)[ \t]*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(region))) {
    const label = (m[1] || m[3]).toLowerCase();
    const text = stripMd(m[2] || m[4] || "");
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, text });
  }
  return out;
}

/** Paragraph letters for a matching-paragraph group: "labelled A–G" → A..G. */
function parseParagraphRange(body: string): ParsedOption[] {
  const m = body.match(/\*{0,2}([A-J])\*{0,2}[ \t]*[–—-][ \t]*\*{0,2}([A-J])\*{0,2}/);
  const from = m ? m[1] : "A";
  const to = m ? m[2] : "H";
  const out: ParsedOption[] = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) {
    out.push({ label: String.fromCharCode(c), text: `Paragraph ${String.fromCharCode(c)}` });
  }
  return out;
}

const TFNG_OPTIONS: ParsedOption[] = ["TRUE", "FALSE", "NOT GIVEN"].map((l) => ({
  label: l,
  text: l,
}));
const YNNG_OPTIONS: ParsedOption[] = ["YES", "NO", "NOT GIVEN"].map((l) => ({
  label: l,
  text: l,
}));

interface RawItem {
  number: number;
  raw: string;
}

/**
 * A group's questions are laid out in one of three ways across the corpus:
 *   1. a numbered marker at line start — `**1.** There are approximately...`
 *   2. a table row — `| **14** | Paragraph B |` (matching-headings in 14/26)
 *   3. an inline blank inside a summary paragraph — `heated by **7** _____`
 * Modes are tried in that order and the first that yields anything wins, so a
 * summary paragraph that merely *mentions* a number cannot fabricate questions
 * for a group that already has real markers.
 */
function findItems(g: Group): RawItem[] {
  const inRange = (n: number) => n >= g.lo && n <= g.hi;

  ITEM_RE.lastIndex = 0;
  const marks: { n: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = ITEM_RE.exec(g.body))) {
    const n = parseInt(m[1], 10);
    if (inRange(n)) marks.push({ n, start: m.index, end: ITEM_RE.lastIndex });
  }
  if (marks.length > 0) {
    return marks.map((mk, i) => ({
      number: mk.n,
      raw: g.body.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : g.body.length),
    }));
  }

  const rows: RawItem[] = [];
  ITEM_ROW_RE.lastIndex = 0;
  while ((m = ITEM_ROW_RE.exec(g.body))) {
    const n = parseInt(m[1], 10);
    if (inRange(n)) rows.push({ number: n, raw: m[2] });
  }
  if (rows.length > 0) return rows;

  // Inline blanks: every blank in the summary shares the summary as its
  // prompt (there is no per-question sentence to isolate), with its own blank
  // marked so a learner can see which gap they are filling.
  const blanks: RawItem[] = [];
  ITEM_BLANK_RE.lastIndex = 0;
  while ((m = ITEM_BLANK_RE.exec(g.body))) {
    const n = parseInt(m[1], 10);
    if (!inRange(n)) continue;
    const para = paragraphAround(g.body, m.index);
    blanks.push({ number: n, raw: para });
  }
  return blanks;
}

/** The blank-line-delimited paragraph containing offset `idx`. */
function paragraphAround(body: string, idx: number): string {
  const before = body.lastIndexOf("\n\n", idx);
  const after = body.indexOf("\n\n", idx);
  return body.slice(before < 0 ? 0 : before + 2, after < 0 ? body.length : after);
}

interface BodyQuestion {
  number: number;
  prompt: string;
  task: IeltsTaskType;
  options: ParsedOption[] | null;
}

export function parseReadingPaper(md: string): Map<number, BodyQuestion> {
  const src = md.replace(/\r\n/g, "\n");
  const out = new Map<number, BodyQuestion>();

  for (const g of findGroups(src)) {
    // Group-level options are identical for every question in the group;
    // MCQ options are per-question and parsed from the item body below.
    let groupOptions: ParsedOption[] | null = null;
    if (g.task === "TFNG") groupOptions = TFNG_OPTIONS;
    else if (g.task === "YNNG") groupOptions = YNNG_OPTIONS;
    else if (g.task === "HEADINGS") groupOptions = parseHeadings(g.body);
    else if (g.task === "MATCH_PARA") groupOptions = parseParagraphRange(g.body);

    // Split the group body into items. An umbrella marker (test_29's
    // `**Questions 1–13**`, whose body ends at the first real sub-group)
    // contains no items, so it contributes nothing — the real sub-groups
    // that follow it own the questions.
    for (const item of findItems(g)) {
      const n = item.number;
      if (n < g.lo || n > g.hi) continue; // stray number inside prose

      let options = groupOptions;
      let text = item.raw;
      if (g.task === "MCQ") {
        const opts: ParsedOption[] = [];
        OPTION_RE.lastIndex = 0;
        let om: RegExpExecArray | null;
        while ((om = OPTION_RE.exec(item.raw))) {
          opts.push({ label: om[1].toUpperCase(), text: stripMd(om[2]) });
        }
        options = opts.length > 1 ? opts : null;
        text = item.raw.replace(OPTION_RE, "");
      }

      const prompt = stripMd(text.split(/\n\s*\n/)[0] || text);
      if (!prompt) continue;
      out.set(n, { number: n, prompt, task: g.task, options });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// answer_key.md — traps 1, 2, 3
// ---------------------------------------------------------------------------

// Most specific first: a matching-heading table has BOTH a paragraph column
// and a heading column, and the heading one is the answer.
const ANSWER_HEADERS = ["đáp án", "answer", "correct heading", "heading", "tiêu đề"];
const EXPLANATION_HEADERS = [
  "explanation",
  "giải thích",
  "why",
  "lý do",
  "source in passage",
  "source paragraph",
  "source",
];

export interface KeyEntry {
  answer: string;
  explanation: string | null;
}

export function parseAnswerKey(md: string): Map<number, KeyEntry> {
  const out = new Map<number, KeyEntry>();
  let answerCol: number | null = null;
  let explCol: number | null = null;

  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;

    // Trap 2: numbers are sometimes bold — strip markdown from every cell
    // before deciding what the cell is.
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.replace(/[*_`]/g, "").trim());
    if (cells.length === 0) continue;
    if (/^[-: ]*$/.test(cells.join(""))) continue; // separator row

    if (!/^\d+$/.test(cells[0])) {
      // Header row: re-arm the parser on this table, or disarm it if this
      // table declares no answer column (that is what keeps the raw→band
      // table out of the answers).
      const head = cells.map((c) => c.toLowerCase());
      answerCol = null;
      for (const w of ANSWER_HEADERS) {
        const i = head.indexOf(w);
        if (i >= 0) {
          answerCol = i;
          break;
        }
      }
      explCol = null;
      if (answerCol !== null) {
        for (const w of EXPLANATION_HEADERS) {
          const i = head.findIndex((h) => h.includes(w));
          if (i >= 0 && i !== answerCol) {
            explCol = i;
            break;
          }
        }
        // No named explanation column: fall back to the last cell after the
        // answer (e.g. `| Q | Paragraph | Correct Heading | Why |`).
        if (explCol === null && cells.length - 1 > answerCol) explCol = cells.length - 1;
      }
      continue;
    }

    if (answerCol === null || cells.length <= answerCol) continue;
    const n = parseInt(cells[0], 10);
    const explanation =
      explCol !== null && explCol < cells.length && cells[explCol] ? cells[explCol] : null;
    out.set(n, { answer: cells[answerCol], explanation });
  }

  // Trap 3: some keys use a numbered list ("1. TRUE") instead of a table.
  // Gap-fill only, so a key with both keeps its table as the source of truth.
  const listRe = /^\s*(\d{1,2})\.\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = listRe.exec(md))) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 40 && !out.has(n)) {
      out.set(n, { answer: m[2].replace(/[*_`]/g, "").trim(), explanation: null });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Merge + verdict
// ---------------------------------------------------------------------------

/** The token a multiple-choice answer really is: `**vii** — The services...` → `vii`. */
function canonicalChoice(task: IeltsTaskType, answer: string): string {
  const a = stripMd(answer);
  if (task === "TFNG" || task === "YNNG") {
    const up = a.toUpperCase();
    return up.startsWith("NOT GIVEN") ? "NOT GIVEN" : up.split(/\s+/)[0];
  }
  const head = a.split(/\s+/)[0].replace(/[.,)]$/, "");
  return task === "HEADINGS" ? head.toLowerCase() : head.toUpperCase();
}

function buildVariants(task: IeltsTaskType, answer: string): ParsedVariant[] {
  if (task === "COMPLETION" || task === "UNKNOWN") {
    // Hard rule: variants separated by "/" are ALL correct.
    const seen = new Set<string>();
    const out: ParsedVariant[] = [];
    for (const part of stripMd(answer).split("/")) {
      const v = mkVariant(part.trim());
      if (!v.text || seen.has(v.normalized)) continue;
      seen.add(v.normalized);
      out.push(v);
    }
    return out;
  }
  const c = canonicalChoice(task, answer);
  return c ? [mkVariant(c)] : [];
}

const TASK_TO_KIND: Record<Exclude<IeltsTaskType, "UNKNOWN">, IeltsQuestionKind> = {
  TFNG: "MULTIPLE_CHOICE",
  YNNG: "MULTIPLE_CHOICE",
  HEADINGS: "MULTIPLE_CHOICE",
  MATCH_PARA: "MULTIPLE_CHOICE",
  MCQ: "MULTIPLE_CHOICE",
  COMPLETION: "FILL_BLANK",
};

export function parseIeltsReading(readingMd: string, keyMd: string): ParsedIeltsReading {
  const body = parseReadingPaper(readingMd);
  const key = parseAnswerKey(keyMd);
  const problems: string[] = [];

  if (body.size === 0) {
    return {
      questions: [],
      problems: ["reading.md: no `Questions a–b` group could be parsed"],
      usable: false,
    };
  }

  const numbers = [...body.keys()].sort((a, b) => a - b);
  const questions: ParsedIeltsQuestion[] = [];
  const missing: number[] = [];
  const unknown: number[] = [];
  const illegal: string[] = [];

  for (const n of numbers) {
    const b = body.get(n)!;
    const k = key.get(n);
    if (b.task === "UNKNOWN") unknown.push(n);
    if (!k) {
      missing.push(n);
      continue;
    }
    if (b.task !== "UNKNOWN" && !legalAnswer(b.task, k.answer)) {
      illegal.push(`Q${n} is ${b.task} but the key says "${k.answer}"`);
    }

    const kind = b.task === "UNKNOWN" ? "FILL_BLANK" : TASK_TO_KIND[b.task];
    const variants = buildVariants(b.task, k.answer);
    if (variants.length === 0) illegal.push(`Q${n}: key cell is empty`);

    // An option list with a single entry is a parse failure, not a question.
    let options = kind === "MULTIPLE_CHOICE" ? b.options : null;
    if (options && options.length < 2) {
      illegal.push(`Q${n}: only ${options.length} option(s) parsed for ${b.task}`);
      options = null;
    }
    if (kind === "MULTIPLE_CHOICE" && !options) {
      illegal.push(`Q${n}: ${b.task} question has no options`);
    } else if (
      options &&
      variants[0] &&
      !options.some((o) => o.label === variants[0].text)
    ) {
      illegal.push(
        `Q${n}: key answer "${variants[0].text}" is not among the offered options`
      );
    }

    questions.push({
      number: n,
      prompt: b.prompt,
      taskType: b.task,
      kind,
      options,
      answerRaw: k.answer,
      explanation: k.explanation,
      variants,
    });
  }

  if (missing.length)
    problems.push(
      `the key answers none of ${missing.length} question(s): ${missing.slice(0, 8).join(", ")}`
    );
  if (unknown.length)
    problems.push(
      `unrecognised question type for ${unknown.length} question(s): ${unknown
        .slice(0, 8)
        .join(", ")}`
    );
  if (illegal.length)
    problems.push(`${illegal.length} answer(s) of the wrong form: ${illegal.slice(0, 4).join("; ")}`);
  if (numbers.length !== 40)
    problems.push(`reading.md declares ${numbers.length} questions (IELTS is 40)`);

  return { questions, problems, usable: problems.length === 0 };
}
