import { parseExercise, type ParsedExercise, type QuestionKind } from "./parse-exercise";

/**
 * content/listening/*.md parser (pure — no I/O).
 *
 * Authoring format:
 * ```
 * ---
 * slug: practice_01
 * title: "Practice Listening: Booking a Swimming Course"
 * kind: PRACTICE
 * voices: { A: en-US-GuyNeural, B: en-GB-SoniaNeural, NARRATOR: en-US-JennyNeural }
 * ---
 * ## TRANSCRIPT
 * NARRATOR: ...
 * A: ...
 * ## QUESTIONS
 * ## SECTION A: FILL IN THE BLANK (Điền vào chỗ trống)
 * 1. ...
 * ## ANSWER KEY (ĐÁP ÁN)
 * ### Section A:
 * 1. ...
 * ```
 *
 * The front matter here is a small hand-authored subset of YAML (flat
 * `key: value` lines plus one single-line flow-mapping for `voices`) —
 * deliberately NOT a full YAML parser, since the authoring format is fully
 * controlled (only this pipeline writes these files). Everything from
 * `## QUESTIONS` onward (sections + `## ANSWER KEY (ĐÁP ÁN)`) is handed
 * as-is to `parseExercise` (Task 4) — question/answer-key parsing is not
 * reimplemented here.
 */

export type CefrLevel = "A2" | "B1" | "B2" | "C1";
const CEFR_LEVELS: readonly string[] = ["A2", "B1", "B2", "C1"];

export interface ListeningFrontMatter {
  slug: string;
  title: string;
  kind: "PLACEMENT" | "PRACTICE";
  /** CEFR difficulty for PRACTICE sets (hub grouping); null for PLACEMENT / legacy files. */
  level: CefrLevel | null;
  /** speaker code (as used in TRANSCRIPT lines, e.g. "A", "NARRATOR") -> edge-tts voice name */
  voices: Record<string, string>;
}

export interface ParsedListening {
  frontMatter: ListeningFrontMatter;
  transcriptMd: string;
  questions: ParsedExercise;
}

const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const TRANSCRIPT_HEAD_RE = /^##[ \t]+TRANSCRIPT[ \t]*$/im;
const QUESTIONS_HEAD_RE = /^##[ \t]+QUESTIONS\b.*$/im;
// `[PAUSE:n]` is a TTS-only directive consumed by generate_audio.py (inserts
// n seconds of silence) — never part of the stored transcript text.
const PAUSE_LINE_RE = /^\[PAUSE:\d+(?:\.\d+)?\][ \t]*$/gm;

function stripPauseLines(s: string): string {
  return s
    .replace(PAUSE_LINE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripQuotes(s: string): string {
  const m = s.match(/^"(.*)"$/);
  return m ? m[1] : s;
}

function parseVoices(raw: string): Record<string, string> {
  const inner = raw.match(/^\{([\s\S]*)\}$/)?.[1] ?? "";
  const voices: Record<string, string> = {};
  for (const pair of inner.split(",")) {
    const idx = pair.indexOf(":");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key && value) voices[key] = value;
  }
  return voices;
}

function parseFrontMatter(block: string): ListeningFrontMatter {
  let slug = "";
  let title = "";
  let kind: "PLACEMENT" | "PRACTICE" = "PRACTICE";
  let levelRaw = "";
  let voices: Record<string, string> = {};

  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z_]+):[ \t]*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (key === "slug") slug = value;
    else if (key === "title") title = stripQuotes(value);
    else if (key === "kind") kind = value === "PLACEMENT" ? "PLACEMENT" : "PRACTICE";
    else if (key === "level") levelRaw = value;
    else if (key === "voices") voices = parseVoices(value);
  }

  if (!slug) throw new Error("parseListening: front matter missing required 'slug'");
  if (!title) throw new Error("parseListening: front matter missing required 'title'");

  let level: CefrLevel | null = null;
  if (levelRaw) {
    const up = levelRaw.toUpperCase();
    if (!CEFR_LEVELS.includes(up)) {
      throw new Error(
        `parseListening: invalid front-matter level '${levelRaw}' (expected A2|B1|B2|C1)`,
      );
    }
    level = up as CefrLevel;
  }

  return { slug, title, kind, level, voices };
}

export function parseListening(md: string, overrides?: Record<string, QuestionKind>): ParsedListening {
  const src = md.replace(/\r\n/g, "\n");

  const fmMatch = src.match(FRONT_MATTER_RE);
  if (!fmMatch) throw new Error("parseListening: missing '---' front matter block");
  const frontMatter = parseFrontMatter(fmMatch[1]);
  const rest = src.slice(fmMatch[0].length);

  const transcriptHeadM = TRANSCRIPT_HEAD_RE.exec(rest);
  if (!transcriptHeadM) throw new Error("parseListening: missing '## TRANSCRIPT' section");
  const transcriptStart = transcriptHeadM.index + transcriptHeadM[0].length;

  const questionsHeadM = QUESTIONS_HEAD_RE.exec(rest);
  const transcriptEnd = questionsHeadM ? questionsHeadM.index : rest.length;
  const transcriptMd = stripPauseLines(rest.slice(transcriptStart, transcriptEnd));

  const questionsMd = questionsHeadM ? rest.slice(questionsHeadM.index + questionsHeadM[0].length) : "";
  const questions = parseExercise(questionsMd, overrides);

  return { frontMatter, transcriptMd, questions };
}
