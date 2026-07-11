/**
 * content/listening/*.md authoring validator — the listening analogue of
 * validate.ts (which deliberately covers only lesson exercises).
 *
 * Usage (from web/):
 *   npm run seed:validate-listening              # exit 1 on ERRORs
 *   npm run seed:validate-listening -- --strict  # exit 1 on WARNs too
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

import { parseListening, type CefrLevel, type ParsedListening } from "./parse-listening";

export interface ListeningIssue {
  slug: string;
  severity: "ERROR" | "WARN";
  message: string;
}

export interface ListeningSetInput {
  file: string;
  raw: string; // raw file contents ([PAUSE:n] lines intact)
  parsed: ParsedListening;
}

export const PRACTICE_SECTIONS = 4;
export const PRACTICE_QUESTIONS_PER_SECTION = 10;
export const PRACTICE_TOTAL_QUESTIONS = 40;

/** Tolerance bands around the per-level duration targets (targets: A2 15–18,
 * B1 19–22, B2 23–27, C1 28–32 min). WARN-only — the estimator is heuristic. */
export const LEVEL_DURATION_TARGETS: Record<CefrLevel, { minSec: number; maxSec: number }> = {
  A2: { minSec: 13 * 60, maxSec: 19 * 60 },
  B1: { minSec: 17 * 60, maxSec: 23 * 60 },
  B2: { minSec: 22 * 60, maxSec: 28 * 60 },
  C1: { minSec: 26 * 60, maxSec: 34 * 60 },
};

const LISTENING_KINDS = new Set(["FILL_BLANK", "MULTIPLE_CHOICE"]);
const PAUSE_RE = /^\[PAUSE:(\d+(?:\.\d+)?)\][ \t]*$/gm;
const NARRATOR_MARKER_RE = /^NARRATOR:\s*Section\s+\d+\b/;
const SPEAKER_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*):/;
const WORDS_PER_MINUTE = 150; // edge-tts default speaking rate, measured on existing sets
const TURN_GAP_SEC = 0.4; // generate_audio.py inserts ~400ms between turns
const SIMILARITY_WARN_THRESHOLD = 0.3;

export function totalPauseSeconds(raw: string): number {
  let sum = 0;
  for (const m of raw.matchAll(PAUSE_RE)) sum += parseFloat(m[1]);
  return sum;
}

export function estimateAudioSeconds(parsed: ParsedListening, raw: string): number {
  const lines = parsed.transcriptMd.split("\n").filter((l) => l.trim() !== "");
  const words = parsed.transcriptMd.split(/\s+/).filter(Boolean).length;
  return Math.round((words * 60) / WORDS_PER_MINUTE + totalPauseSeconds(raw) + lines.length * TURN_GAP_SEC);
}

/** Jaccard similarity over word 3-gram shingles, computed after dropping
 * NARRATOR lines (shared boilerplate) and normalizing. */
export function transcriptSimilarity(a: string, b: string): number {
  const shingles = (t: string): Set<string> => {
    const words = t
      .split("\n")
      .filter((l) => !l.startsWith("NARRATOR:"))
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0 && !/^\d+$/.test(w)); // strip pure-digit tokens: numbers (times, counts,
      // question indices) repeat across unrelated transcripts and would otherwise dominate the shingle
      // overlap regardless of actual shared content
    const set = new Set<string>();
    for (let i = 0; i + 2 < words.length; i++) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    return set;
  };
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

function probeDurationSec(mp3Path: string): number | null {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3Path])
      .toString()
      .trim();
    const sec = parseFloat(out);
    return Number.isFinite(sec) ? Math.round(sec) : null;
  } catch {
    return null;
  }
}

export function checkListeningSet(input: ListeningSetInput, publicDir: string): ListeningIssue[] {
  const issues: ListeningIssue[] = [];
  const { parsed, file, raw } = input;
  const fm = parsed.frontMatter;
  const slug = fm.slug;
  const err = (message: string) => issues.push({ slug, severity: "ERROR", message });
  const warn = (message: string) => issues.push({ slug, severity: "WARN", message });

  const base = path.basename(file, ".md");
  if (slug !== base) err(`slug '${slug}' != filename '${base}.md'`);

  const isPractice = fm.kind === "PRACTICE";
  if (isPractice && !fm.level) err("PRACTICE set missing front-matter 'level' (A2|B1|B2|C1)");
  if (!isPractice && fm.level) warn("PLACEMENT set has a 'level' — ignored by the app");

  const sections = parsed.questions.sections;
  const questions = sections.flatMap((s) => s.questions);

  if (isPractice) {
    if (sections.length !== PRACTICE_SECTIONS)
      err(`expected ${PRACTICE_SECTIONS} sections, found ${sections.length}`);
    if (questions.length !== PRACTICE_TOTAL_QUESTIONS)
      err(`expected ${PRACTICE_TOTAL_QUESTIONS} questions, found ${questions.length}`);
    for (const s of sections) {
      if (s.questions.length !== PRACTICE_QUESTIONS_PER_SECTION)
        err(`section '${s.label}' has ${s.questions.length} questions (expected ${PRACTICE_QUESTIONS_PER_SECTION})`);
    }

    const numbers = questions.map((q) => q.number);
    const expected = Array.from({ length: questions.length }, (_, i) => i + 1);
    if (JSON.stringify(numbers) !== JSON.stringify(expected))
      err("question numbers are not exactly 1..40 ascending across sections");

    for (const s of sections) {
      if (!LISTENING_KINDS.has(s.kind))
        err(`section '${s.label}' parsed as ${s.kind} — listening sections must be FILL_BLANK or MULTIPLE_CHOICE (check the section title keywords)`);
    }

    for (const q of questions) {
      if (q.isOpenEnded) err(`question ${q.number} is open-ended — listening answers must be objective`);
      else if (q.variants.length === 0)
        err(`question ${q.number} has no answer variants — grading would reject every input`);
    }

    for (const s of sections) {
      if (s.kind !== "MULTIPLE_CHOICE") continue;
      for (const q of s.questions) {
        if (!q.options || q.options.length < 2) warn(`MCQ ${q.number} has fewer than 2 options`);
        const first = (q.variants[0]?.text ?? "").trim().toUpperCase();
        if (!/^[A-D]/.test(first)) warn(`MCQ ${q.number} first variant '${q.variants[0]?.text ?? ""}' is not a letter A–D`);
      }
    }

    const markerCount = parsed.transcriptMd.split("\n").filter((l) => NARRATOR_MARKER_RE.test(l)).length;
    if (markerCount !== sections.length)
      err(`found ${markerCount} 'NARRATOR: Section N.' markers for ${sections.length} sections — per-section transcript unlock needs exactly one per section`);

    const pauses = totalPauseSeconds(raw);
    if (pauses < 90 || pauses > 600) warn(`total [PAUSE] budget ${pauses}s outside [90, 600]s`);
    for (const m of raw.matchAll(PAUSE_RE)) {
      if (parseFloat(m[1]) > 60) warn(`single [PAUSE:${m[1]}] longer than 60s`);
    }

    if (fm.level) {
      const band = LEVEL_DURATION_TARGETS[fm.level];
      const est = estimateAudioSeconds(parsed, raw);
      if (est < band.minSec || est > band.maxSec)
        warn(`estimated audio ≈${(est / 60).toFixed(1)}min outside ${fm.level} band ${band.minSec / 60}–${band.maxSec / 60}min`);
      const mp3 = path.join(publicDir, "audio", "listening", `${slug}.mp3`);
      if (!fs.existsSync(mp3)) {
        warn("no generated mp3 yet (run scripts/tts/generate_audio.py)");
      } else {
        const dur = probeDurationSec(mp3);
        if (dur !== null && (dur < band.minSec || dur > band.maxSec))
          warn(`generated mp3 is ${(dur / 60).toFixed(1)}min — outside ${fm.level} band ${band.minSec / 60}–${band.maxSec / 60}min`);
      }
      if (markerCount === sections.length) {
        const sectionMp3Count = sections.filter((_, i) =>
          fs.existsSync(path.join(publicDir, "audio", "listening", `${slug}_s${i + 1}.mp3`)),
        ).length;
        if (sectionMp3Count < sections.length) {
          warn(
            `only ${sectionMp3Count}/${sections.length} per-section mp3s found (${slug}_s1.mp3.. — re-run scripts/tts/generate_audio.py)`,
          );
        }
      }
    }
  }

  if (!parsed.questions.diagnostics.keyFound) err("no ANSWER KEY (ĐÁP ÁN) block found");
  if (parsed.questions.diagnostics.unmatchedAnswers.length > 0)
    err(`answer-key entries matched no question: ${parsed.questions.diagnostics.unmatchedAnswers.join(", ")}`);

  for (const q of questions) {
    if (q.imageUrl && !fs.existsSync(path.join(publicDir, q.imageUrl.replace(/^\//, ""))))
      err(`question ${q.number} imageUrl ${q.imageUrl} not found under web/public`);
  }

  if (parsed.transcriptMd.trim() === "") err("empty TRANSCRIPT");

  const speakers = new Set<string>();
  for (const line of parsed.transcriptMd.split("\n")) {
    const m = line.match(SPEAKER_LINE_RE);
    if (m) speakers.add(m[1]);
  }
  for (const sp of speakers) {
    if (!fm.voices[sp]) err(`transcript speaker '${sp}' has no front-matter voices mapping`);
  }

  return issues;
}

export function checkCorpus(inputs: ListeningSetInput[]): ListeningIssue[] {
  const issues: ListeningIssue[] = [];
  const bySlug = new Map<string, string>();
  const byTitle = new Map<string, string>();
  for (const input of inputs) {
    const slug = input.parsed.frontMatter.slug;
    const titleKey = input.parsed.frontMatter.title.trim().toLowerCase();
    if (bySlug.has(slug)) issues.push({ slug, severity: "ERROR", message: `duplicate slug (also in ${bySlug.get(slug)})` });
    else bySlug.set(slug, input.file);
    if (byTitle.has(titleKey)) issues.push({ slug, severity: "ERROR", message: `duplicate title (also in ${byTitle.get(titleKey)})` });
    else byTitle.set(titleKey, input.file);
  }
  const practice = inputs.filter((i) => i.parsed.frontMatter.kind === "PRACTICE");
  for (let a = 0; a < practice.length; a++) {
    for (let b = a + 1; b < practice.length; b++) {
      const sim = transcriptSimilarity(practice[a].parsed.transcriptMd, practice[b].parsed.transcriptMd);
      if (sim > SIMILARITY_WARN_THRESHOLD) {
        issues.push({
          slug: practice[a].parsed.frontMatter.slug,
          severity: "WARN",
          message: `possible duplicate content vs ${practice[b].parsed.frontMatter.slug} (similarity ${sim.toFixed(2)})`,
        });
      }
    }
  }
  return issues;
}

export function loadListeningInputs(contentDir: string): ListeningSetInput[] {
  return fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const file = path.join(contentDir, f);
      const raw = fs.readFileSync(file, "utf8");
      return { file, raw, parsed: parseListening(raw) };
    });
}

function main() {
  const strict = process.argv.includes("--strict");
  const webRoot = process.cwd(); // npm scripts run from web/
  const contentDir = path.join(webRoot, "content", "listening");
  const publicDir = path.join(webRoot, "public");

  const inputs = loadListeningInputs(contentDir);
  const all: ListeningIssue[] = [];
  for (const input of inputs) {
    const issues = checkListeningSet(input, publicDir);
    all.push(...issues);
    const fm = input.parsed.frontMatter;
    const qs = input.parsed.questions.sections.reduce((n, s) => n + s.questions.length, 0);
    const status = issues.some((i) => i.severity === "ERROR") ? "ERR " : issues.length > 0 ? "WARN" : "OK  ";
    console.log(
      `${status} ${fm.slug}: kind=${fm.kind} level=${fm.level ?? "-"} sections=${input.parsed.questions.sections.length} questions=${qs} pauses=${totalPauseSeconds(input.raw)}s est≈${(estimateAudioSeconds(input.parsed, input.raw) / 60).toFixed(1)}min`,
    );
  }
  all.push(...checkCorpus(inputs));

  for (const issue of all) console.log(`  [${issue.severity}] ${issue.slug}: ${issue.message}`);
  const errorCount = all.filter((i) => i.severity === "ERROR").length;
  const warnCount = all.length - errorCount;
  console.log(`\n${inputs.length} file(s) checked — ${errorCount} error(s), ${warnCount} warning(s)`);
  if (errorCount > 0 || (strict && warnCount > 0)) process.exit(1);
}

// tsx runs this file directly; vitest imports it (argv[1] = vitest binary).
if (process.argv[1] && path.basename(process.argv[1]).startsWith("check-listening")) main();
