# Luyện Nghe Expansion Implementation Plan — 14 leveled 40-question listening sets

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠ Session rule (user-mandated):** never run subagents in parallel — at most ONE at a time, sequential.
>
> **⚠ Scope of the planning session that produced this document:** the only deliverable was to SAVE this file to `docs/superpowers/plans/2026-07-10-listening-practice-expansion.md`. No task below was executed. Implementation happens in later sessions.

**Goal:** Grow the webapp's "Luyện Nghe" practice hub from 2 short sets (10 câu, ~2–3 phút) to 14 non-duplicated sets of 40 câu each across 4 CEFR levels (A2×5, B1×3, B2×3, C1×3) with level-appropriate audio lengths (~15→~32 phút), a level-grouped hub, and a sectioned (4 phần × 10 câu) runner with per-section transcript unlock.

**Architecture:** Listening sets stay Markdown-authored (`web/content/listening/*.md`) → parsed at seed time → Postgres via Prisma → server-rendered pages + a stateless check API. This plan adds: a `CefrLevel` enum + `ListeningSet.level` column, front-matter `level:`, an authoring validator (`check-listening.ts`), a level-grouped hub, a section-aware runner (data-driven — reuses the existing forward-only reducer and check API unchanged), and 12 new + 2 upgraded content files with locally generated edge-tts audio.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript, Prisma 6 + PostgreSQL, Vitest, Tailwind 4, Python `edge-tts==7.2.8` + `pydub` + `ffmpeg` (local audio generation only).

## Global Constraints

- All work is inside `web/` — the repo-root curriculum, `index/manifest.json`, and `scripts/build_index.py` are untouched (web content is not part of the curriculum manifest).
- Bilingual convention: Vietnamese UI copy/framing, English listening content. Never translate existing content.
- Answer keys are the single source of truth; alternate answers separated by `/`; never invent answers.
- Every PRACTICE set: exactly 4 sections × 10 questions = 40, numbered 1–40 globally ascending.
- Section kinds: ONLY `FILL_BLANK` and `MULTIPLE_CHOICE`, via the exact section titles `FILL IN THE BLANK (Điền vào chỗ trống)` / `MULTIPLE CHOICE (Trắc nghiệm)` (these keywords drive `inferKind` in `web/scripts/seed/parse-exercise.ts`; a "MIXED" title degrades to unusable kinds — forbidden).
- Every section's transcript opens with a `NARRATOR: Section N. …` line (per-section transcript unlock splits on it) and closes with a narrator outro line that does NOT start with "NARRATOR: Section".
- Audio: generated locally by `web/scripts/tts/generate_audio.py`, output committed to git at `web/public/audio/listening/<slug>.mp3`, 48 kbps mono (keep — clarity for spelled names/numbers; ~0.36 MB/min).
- Duration targets: A2 15–18 min, B1 19–22 min, B2 23–27 min, C1 28–32 min (validator tolerance bands slightly wider, see `LEVEL_DURATION_TARGETS`).
- NARRATOR voice is always `en-US-JennyNeural`; never reuse the narrator's voice for a character.
- No two sets share a topic/title; new topics must also differ from `placement_ielts` (leisure-centre signup, science-centre tour, green-space research, coral-reef lecture) and `placement_toeic` (office/announcement snippets).
- Work directly on `main`; one commit per task.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## Verified starting-point facts

- Hub `web/src/app/(app)/listening/page.tsx` lists all `kind: "PRACTICE"` sets `orderBy: { slug: "asc" }` — no hardcoded ids anywhere; question count is pure data.
- Runner `web/src/components/ListeningRunner.tsx` is one-question-at-a-time retry-until-correct over a flat `SafeQuestion[]`; `web/src/components/ListeningSetView.tsx` gates the transcript on completing ALL questions.
- `web/src/lib/listening.ts` already exports `getOrderedListeningSections(listeningSetId)` returning `ListeningSectionWithQuestions[]` (label/title/instructions/kind + ordered questions) — exactly what the sectioned runner needs.
- `parseListening` front matter is flat `key: value` lines (`/^([A-Za-z_]+):[ \t]*(.*)$/`); `generate_audio.py` ignores unknown front-matter keys → adding `level:` needs no Python change.
- `ParsedExercise.diagnostics = { keyFound: boolean; unmatchedAnswers: string[] }` (verified in `parse-exercise.ts:55-63`).
- Seeding (`seedListeningSets` in `web/scripts/seed/ingest.ts:70-149`) is delete-and-recreate per slug; renamed slugs would orphan old rows → Task 3 adds pruning.
- `web/scripts/seed/seed-placement.ts` hardcodes only `placement_ielts`/`placement_toeic` — renaming the two practice files is safe.
- Existing practice transcripts contain `NARRATOR: Section 1.` markers; TOEIC uses "Part N" → the transcript splitter must fall back gracefully.
- Dockerfile already copies `web/content/` and `web/public/` into the runner image — no deploy change needed beyond `make migrate && make seed`.

---

# PHASE A — Platform (Tasks 1–9, sequential)

### Task 1: Prisma schema — `CefrLevel` enum + `ListeningSet.level`

**Files:**
- Modify: `web/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma enum `CefrLevel { A2 B1 B2 C1 }`; column `ListeningSet.level: CefrLevel?` — consumed by Tasks 3, 7, 8 via `@prisma/client`.

- [ ] **Step 1: Add the enum and column**

Immediately after the existing `enum ListeningKind` block add:

```prisma
enum CefrLevel {
  A2
  B1
  B2
  C1
}
```

In `model ListeningSet`, after the `kind` field add:

```prisma
  level        CefrLevel? // PRACTICE difficulty for the Luyện Nghe hub; null for PLACEMENT sets
```

- [ ] **Step 2: Validate and migrate**

```bash
cd web
npm run db:validate
npm run db:migrate -- --name listening_set_level
```

Expected: new `web/prisma/migrations/<timestamp>_listening_set_level/migration.sql` containing exactly:

```sql
-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A2', 'B1', 'B2', 'C1');

-- AlterTable
ALTER TABLE "ListeningSet" ADD COLUMN "level" "CefrLevel";
```

(`prisma migrate dev` also regenerates the client, so `CefrLevel` is importable from `@prisma/client`.)

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(listening): CefrLevel enum + ListeningSet.level column"
```

### Task 2: Parser — front-matter `level` (TDD)

**Files:**
- Modify: `web/scripts/seed/parse-listening.ts`
- Test: `web/scripts/seed/parse-listening.test.ts`

**Interfaces:**
- Produces: `export type CefrLevel = "A2" | "B1" | "B2" | "C1"` and `ListeningFrontMatter.level: CefrLevel | null` — consumed by Tasks 3 and 6. (String values intentionally identical to the Prisma enum so `level` passes straight into `db.listeningSet.create`.)

- [ ] **Step 1: Write the failing tests**

Append to `web/scripts/seed/parse-listening.test.ts` (vitest imports already present in the file):

```ts
describe("front-matter level", () => {
  const md = (levelLine: string) => `---
slug: level_fixture
title: "Level Fixture"
kind: PRACTICE
${levelLine}voices: { A: en-US-GuyNeural, NARRATOR: en-US-JennyNeural }
---
## TRANSCRIPT
NARRATOR: Section 1. Listen to the recording.
A: Hello there.
## QUESTIONS
## SECTION 1: FILL IN THE BLANK (Điền vào chỗ trống)
1. Say ______ .
## ANSWER KEY (ĐÁP ÁN)
### Section 1:
1. hello
`;

  it("parses a valid level", () => {
    expect(parseListening(md("level: B1\n")).frontMatter.level).toBe("B1");
  });

  it("is null when absent", () => {
    expect(parseListening(md("")).frontMatter.level).toBeNull();
  });

  it("normalizes lowercase input", () => {
    expect(parseListening(md("level: b2\n")).frontMatter.level).toBe("B2");
  });

  it("throws on invalid values", () => {
    expect(() => parseListening(md("level: D7\n"))).toThrow(/invalid front-matter level/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run scripts/seed/parse-listening.test.ts`
Expected: FAIL — `level` is `undefined` / no error thrown.

- [ ] **Step 3: Implement**

In `web/scripts/seed/parse-listening.ts`:

```ts
export type CefrLevel = "A2" | "B1" | "B2" | "C1";
const CEFR_LEVELS: readonly string[] = ["A2", "B1", "B2", "C1"];
```

Extend the interface:

```ts
export interface ListeningFrontMatter {
  slug: string;
  title: string;
  kind: "PLACEMENT" | "PRACTICE";
  /** CEFR difficulty for PRACTICE sets (hub grouping); null for PLACEMENT / legacy files. */
  level: CefrLevel | null;
  /** speaker code (as used in TRANSCRIPT lines, e.g. "A", "NARRATOR") -> edge-tts voice name */
  voices: Record<string, string>;
}
```

In `parseFrontMatter`, add `let levelRaw = "";` beside the other locals, add the branch `else if (key === "level") levelRaw = value;`, and before the `return`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run scripts/seed/parse-listening.test.ts`
Expected: PASS (all existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/parse-listening.ts scripts/seed/parse-listening.test.ts
git commit -m "feat(listening): parse front-matter level (A2|B1|B2|C1)"
```

### Task 3: Ingest — persist `level` + prune orphaned slugs

**Files:**
- Modify: `web/scripts/seed/ingest.ts` (`seedListeningSets`, lines ~70–149)

**Interfaces:**
- Consumes: `parsed.frontMatter.level` (Task 2), `ListeningSet.level` (Task 1).
- Produces: seeded rows carry `level`; sets whose `.md` was renamed/deleted are pruned from the DB (needed for Task 10/11 slug renames).

- [ ] **Step 1: Persist level + warn on missing**

In `seedListeningSets`, add `const seenSlugs: string[] = [];` before the file loop. Inside the loop change the destructure and add the warning:

```ts
    const { slug, title, kind, level } = parsed.frontMatter;
    seenSlugs.push(slug);
    if (kind === "PRACTICE" && !level) {
      console.warn(
        `[seed] WARN: ${slug} is PRACTICE but has no front-matter 'level' — hub will group it under "Khác"`,
      );
    }
```

In the `db.listeningSet.create({ data: { … } })` call, after `kind,` add:

```ts
        level: level ?? undefined,
```

- [ ] **Step 2: Prune orphans after the loop**

Immediately before the `return { count, questions: totalQuestions };` line:

```ts
  // Prune sets whose .md no longer exists (e.g. renamed slugs). Guarded on
  // files.length so an empty/missing content dir can never mass-delete.
  if (files.length > 0) {
    if (dryRun) {
      const orphans = await db.listeningSet.findMany({
        where: { slug: { notIn: seenSlugs } },
        select: { slug: true },
      });
      if (orphans.length > 0) {
        console.log(`[seed] would prune listening set(s): ${orphans.map((o) => o.slug).join(", ")}`);
      }
    } else {
      const pruned = await db.listeningSet.deleteMany({ where: { slug: { notIn: seenSlugs } } });
      if (pruned.count > 0) {
        console.log(`[seed] pruned ${pruned.count} listening set(s) no longer in content/listening`);
      }
    }
  }
```

- [ ] **Step 3: Verify with a dry run**

Run: `cd web && npm run seed -- --dry-run`
Expected: the 4 existing listening sets listed as today, plus two `WARN: … no front-matter 'level'` lines (practice_01, placement_01 — fixed later by Tasks 10–11); no prune line (nothing renamed yet).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed/ingest.ts
git commit -m "feat(listening): seed level column and prune orphaned listening slugs"
```

### Task 4: Pure lib — per-section transcript splitting (TDD)

**Files:**
- Create: `web/src/lib/transcript.ts`
- Test: `web/src/lib/transcript.test.ts`

**Interfaces:**
- Produces: `transcriptChunksForSections(transcriptMd: string, sectionCount: number): string[] | null` — consumed by Task 8 (`ListeningSetView`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { transcriptChunksForSections } from "./transcript";

const FOUR_SECTIONS = [
  "Welcome preamble line.",
  "NARRATOR: Section 1. You will hear a phone call. First, look at questions 1 to 10.",
  "A: Hello, this is section one speech.",
  "NARRATOR: That is the end of Section 1. Check your answers.",
  "NARRATOR: Section 2. You will hear a talk.",
  "C: Section two monologue.",
  "NARRATOR: Section 3. You will hear a discussion.",
  "D: Section three dialogue.",
  "NARRATOR: Section 4. You will hear a lecture.",
  "F: Section four lecture.",
].join("\n");

describe("transcriptChunksForSections", () => {
  it("splits into one chunk per section, preamble joins chunk 0", () => {
    const chunks = transcriptChunksForSections(FOUR_SECTIONS, 4);
    expect(chunks).toHaveLength(4);
    expect(chunks![0]).toContain("Welcome preamble line.");
    expect(chunks![0]).toContain("section one speech");
    expect(chunks![0]).toContain("end of Section 1"); // outro stays in its own chunk
    expect(chunks![1]).toContain("Section two monologue");
    expect(chunks![3]).toContain("Section four lecture");
  });

  it("returns null when marker count != sectionCount", () => {
    expect(transcriptChunksForSections(FOUR_SECTIONS, 2)).toBeNull();
  });

  it("returns null when there are no markers (e.g. TOEIC 'Part N')", () => {
    expect(transcriptChunksForSections("NARRATOR: Part 1. Photographs.\nA: text", 4)).toBeNull();
  });

  it("returns null when marker numbers are out of order", () => {
    const bad = FOUR_SECTIONS.replace("NARRATOR: Section 2.", "NARRATOR: Section 3.").replace(
      "NARRATOR: Section 3. You will hear a discussion.",
      "NARRATOR: Section 2. You will hear a discussion.",
    );
    expect(transcriptChunksForSections(bad, 4)).toBeNull();
  });

  it("returns null for sectionCount <= 0", () => {
    expect(transcriptChunksForSections(FOUR_SECTIONS, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/lib/transcript.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `web/src/lib/transcript.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/lib/transcript.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transcript.ts src/lib/transcript.test.ts
git commit -m "feat(listening): per-section transcript splitter with legacy fallback"
```

### Task 5: Pure lib — section boundary helpers (TDD)

**Files:**
- Create: `web/src/components/runner/sections.ts`
- Test: `web/src/components/runner/sections.test.ts`

**Interfaces:**
- Produces (all consumed by Task 8's runner):
  - `sectionStartIndexes(counts: number[]): number[]`
  - `sectionIndexForQuestion(counts: number[], flatIndex: number): number`
  - `questionIndexInSection(counts: number[], flatIndex: number): number`
  - `completedSectionCount(counts: number[], flatIndex: number, finished: boolean): number`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import {
  completedSectionCount,
  questionIndexInSection,
  sectionIndexForQuestion,
  sectionStartIndexes,
} from "./sections";

describe("section boundary helpers", () => {
  it("computes start indexes", () => {
    expect(sectionStartIndexes([10, 10, 10, 10])).toEqual([0, 10, 20, 30]);
    expect(sectionStartIndexes([3, 7, 2])).toEqual([0, 3, 10]);
    expect(sectionStartIndexes([])).toEqual([]);
  });

  it("maps flat index to section index", () => {
    expect(sectionIndexForQuestion([10, 10, 10, 10], 0)).toBe(0);
    expect(sectionIndexForQuestion([10, 10, 10, 10], 9)).toBe(0);
    expect(sectionIndexForQuestion([10, 10, 10, 10], 10)).toBe(1);
    expect(sectionIndexForQuestion([10, 10, 10, 10], 39)).toBe(3);
    expect(sectionIndexForQuestion([3, 7, 2], 3)).toBe(1);
    expect(sectionIndexForQuestion([3, 7, 2], 11)).toBe(2); // clamps past the end
  });

  it("maps flat index to index within its section", () => {
    expect(questionIndexInSection([10, 10, 10, 10], 0)).toBe(0);
    expect(questionIndexInSection([10, 10, 10, 10], 15)).toBe(5);
    expect(questionIndexInSection([3, 7, 2], 9)).toBe(6);
  });

  it("counts fully completed sections", () => {
    expect(completedSectionCount([10, 10, 10, 10], 0, false)).toBe(0);
    expect(completedSectionCount([10, 10, 10, 10], 9, false)).toBe(0);
    expect(completedSectionCount([10, 10, 10, 10], 10, false)).toBe(1);
    expect(completedSectionCount([10, 10, 10, 10], 39, false)).toBe(3);
    expect(completedSectionCount([10, 10, 10, 10], 39, true)).toBe(4);
    expect(completedSectionCount([5, 5], 5, false)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/components/runner/sections.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `web/src/components/runner/sections.ts`**

```ts
/**
 * Pure index math for rendering a flat forward-only runner (reducer.ts) as
 * "Phần 1..N" sections. `counts` = questions per section, in order.
 */
export function sectionStartIndexes(counts: number[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const c of counts) {
    starts.push(acc);
    acc += c;
  }
  return starts;
}

export function sectionIndexForQuestion(counts: number[], flatIndex: number): number {
  let acc = 0;
  for (let s = 0; s < counts.length; s++) {
    acc += counts[s];
    if (flatIndex < acc) return s;
  }
  return Math.max(0, counts.length - 1);
}

export function questionIndexInSection(counts: number[], flatIndex: number): number {
  const s = sectionIndexForQuestion(counts, flatIndex);
  return flatIndex - sectionStartIndexes(counts)[s];
}

/** Sections fully answered: all when finished, else those strictly before flatIndex. */
export function completedSectionCount(
  counts: number[],
  flatIndex: number,
  finished: boolean,
): number {
  if (finished) return counts.length;
  let acc = 0;
  let done = 0;
  for (const c of counts) {
    acc += c;
    if (flatIndex >= acc) done++;
    else break;
  }
  return done;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run src/components/runner/sections.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/runner/sections.ts src/components/runner/sections.test.ts
git commit -m "feat(listening): section boundary helpers for the sectioned runner"
```

### Task 6: Listening content validator + npm script (TDD)

**Files:**
- Create: `web/scripts/seed/check-listening.ts`
- Test: `web/scripts/seed/check-listening.test.ts`
- Modify: `web/package.json` (one script line)

**Interfaces:**
- Consumes: `parseListening`, `CefrLevel`, `ParsedListening` (Task 2); `ParsedExercise.diagnostics` (existing).
- Produces: `checkListeningSet(input, publicDir)`, `checkCorpus(inputs)`, `loadListeningInputs(contentDir)`, `totalPauseSeconds(raw)`, `estimateAudioSeconds(parsed, raw)`, `transcriptSimilarity(a, b)`, `LEVEL_DURATION_TARGETS`; CLI `npm run seed:validate-listening [-- --strict]`. This is the authoring gate every content task (10–16) must pass.

- [ ] **Step 1: Write the failing tests — `web/scripts/seed/check-listening.test.ts`**

```ts
import path from "path";
import { describe, expect, it } from "vitest";

import { parseListening } from "./parse-listening";
import {
  checkCorpus,
  checkListeningSet,
  estimateAudioSeconds,
  totalPauseSeconds,
  transcriptSimilarity,
  type ListeningSetInput,
} from "./check-listening";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");
const DEFAULT_LINE = "the library desk is open every weekday morning for students";

interface FixtureOpts {
  slug?: string;
  title?: string;
  level?: string | null;
  sections?: number;
  questionsPerSection?: number;
  dropKey?: boolean;
  dropMarkers?: boolean;
  extraSpeaker?: boolean;
  pauseSeconds?: number;
  lineWords?: string;
}

function makeSetMd({
  slug = "practice_b1_99",
  title = "Practice Listening: Fixture Set",
  level = "B1",
  sections = 4,
  questionsPerSection = 10,
  dropKey = false,
  dropMarkers = false,
  extraSpeaker = false,
  pauseSeconds = 45,
  lineWords = DEFAULT_LINE,
}: FixtureOpts = {}): string {
  const kinds = ["FILL", "MCQ", "MCQ", "FILL"];
  let qNum = 0;
  const transcript: string[] = [];
  const questionBlocks: string[] = [];
  const keyBlocks: string[] = [];
  for (let s = 0; s < sections; s++) {
    if (!dropMarkers) transcript.push(`NARRATOR: Section ${s + 1}. Now look at the questions.`);
    transcript.push(`[PAUSE:${pauseSeconds}]`);
    for (let i = 0; i < 30; i++) {
      transcript.push(`${s % 2 === 0 ? "A" : "B"}: ${lineWords} item ${s} ${i}.`);
    }
    if (extraSpeaker && s === 0) transcript.push("Z: An unmapped speaker line.");
    const kind = kinds[s % 4];
    const header =
      kind === "FILL" ? "FILL IN THE BLANK (Điền vào chỗ trống)" : "MULTIPLE CHOICE (Trắc nghiệm)";
    const qLines: string[] = [`## SECTION ${s + 1}: ${header}`];
    const kLines: string[] = [`### Section ${s + 1}:`];
    for (let q = 0; q < questionsPerSection; q++) {
      qNum++;
      if (kind === "FILL") {
        qLines.push(`${qNum}. The answer to item ${qNum} is ______ .`);
        kLines.push(`${qNum}. answer${qNum}`);
      } else {
        qLines.push(`${qNum}. What is item ${qNum}?`, "- A) First", "- B) Second", "- C) Third", "- D) Fourth");
        kLines.push(`${qNum}. B (Second)`);
      }
    }
    questionBlocks.push(qLines.join("\n"));
    keyBlocks.push(kLines.join("\n"));
  }
  return [
    "---",
    `slug: ${slug}`,
    `title: "${title}"`,
    "kind: PRACTICE",
    ...(level ? [`level: ${level}`] : []),
    "voices: { A: en-US-GuyNeural, B: en-GB-SoniaNeural, NARRATOR: en-US-JennyNeural }",
    "---",
    "## TRANSCRIPT",
    ...transcript,
    "## QUESTIONS",
    ...questionBlocks,
    ...(dropKey ? [] : ["## ANSWER KEY (ĐÁP ÁN)", ...keyBlocks]),
    "",
  ].join("\n");
}

function makeInput(overrides: FixtureOpts = {}): ListeningSetInput {
  const raw = makeSetMd(overrides);
  const slug = overrides.slug ?? "practice_b1_99";
  return { file: `/content/listening/${slug}.md`, raw, parsed: parseListening(raw) };
}

const errors = (issues: ReturnType<typeof checkListeningSet>) =>
  issues.filter((i) => i.severity === "ERROR");

describe("checkListeningSet", () => {
  it("passes a well-formed 4×10 practice set with no ERRORs", () => {
    expect(errors(checkListeningSet(makeInput(), PUBLIC_DIR))).toEqual([]);
  });

  it("flags wrong section count", () => {
    const issues = checkListeningSet(makeInput({ sections: 3 }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /expected 4 sections/.test(i.message))).toBe(true);
  });

  it("flags wrong total question count", () => {
    const issues = checkListeningSet(makeInput({ questionsPerSection: 9 }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /expected 40 questions/.test(i.message))).toBe(true);
  });

  it("flags missing level on PRACTICE sets", () => {
    const issues = checkListeningSet(makeInput({ level: null }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /missing front-matter 'level'/.test(i.message))).toBe(true);
  });

  it("flags a missing answer key", () => {
    const issues = checkListeningSet(makeInput({ dropKey: true }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /no ANSWER KEY/.test(i.message))).toBe(true);
  });

  it("flags transcript speakers without a voices mapping", () => {
    const issues = checkListeningSet(makeInput({ extraSpeaker: true }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /speaker 'Z'/.test(i.message))).toBe(true);
  });

  it("flags missing NARRATOR section markers", () => {
    const issues = checkListeningSet(makeInput({ dropMarkers: true }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /NARRATOR: Section N/.test(i.message))).toBe(true);
  });

  it("warns on an oversized single pause", () => {
    const issues = checkListeningSet(makeInput({ pauseSeconds: 900 }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "WARN" && /longer than 60s/.test(i.message))).toBe(true);
  });
});

describe("checkCorpus", () => {
  it("flags duplicate titles", () => {
    const a = makeInput({ slug: "practice_b1_98" });
    const b = makeInput({ slug: "practice_b1_97" });
    expect(checkCorpus([a, b]).some((i) => i.severity === "ERROR" && /duplicate title/.test(i.message))).toBe(true);
  });

  it("warns on near-identical transcripts, passes distinct ones", () => {
    const a = makeInput({ slug: "practice_b1_98", title: "Practice Listening: Fixture A" });
    const b = makeInput({ slug: "practice_b1_97", title: "Practice Listening: Fixture B" });
    expect(checkCorpus([a, b]).some((i) => /possible duplicate content/.test(i.message))).toBe(true);

    const c = makeInput({
      slug: "practice_b2_01",
      title: "Practice Listening: Fixture C",
      lineWords: "our ferry departs from harbour gate nine at dawn with crew",
    });
    expect(checkCorpus([a, c]).some((i) => /possible duplicate content/.test(i.message))).toBe(false);
  });
});

describe("pause and duration estimation", () => {
  it("sums [PAUSE:n] lines", () => {
    expect(totalPauseSeconds("A: hi\n[PAUSE:20]\nB: yo\n[PAUSE:15.5]\n")).toBeCloseTo(35.5);
  });

  it("similarity is ~1 for identical and ~0 for disjoint text", () => {
    const t = "A: one two three four five six seven eight nine ten";
    expect(transcriptSimilarity(t, t)).toBeCloseTo(1);
    expect(transcriptSimilarity(t, "B: alpha beta gamma delta epsilon zeta eta theta")).toBe(0);
  });

  it("estimate includes speech, pauses and turn gaps", () => {
    const input = makeInput();
    expect(estimateAudioSeconds(input.parsed, input.raw)).toBeGreaterThan(totalPauseSeconds(input.raw));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run scripts/seed/check-listening.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `web/scripts/seed/check-listening.ts`**

```ts
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
      .filter(Boolean);
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
```

- [ ] **Step 4: Add the npm script**

In `web/package.json` scripts, after `"seed:validate"`:

```json
    "seed:validate-listening": "tsx scripts/seed/check-listening.ts",
```

(No DB access — no dotenv needed.)

- [ ] **Step 5: Run tests + CLI against existing content**

```bash
cd web
npx vitest run scripts/seed/check-listening.test.ts   # Expected: PASS
npm run seed:validate-listening
```

Expected CLI: `placement_ielts` / `placement_toeic` report `OK`/`WARN` with no ERRORs; `practice_01` and `placement_01` report `ERR` (not yet 4×10, no level) — **expected and acceptable until Tasks 10–11**; exit code 1 is fine at this stage. Do not "fix" the old files here.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed/check-listening.ts scripts/seed/check-listening.test.ts package.json
git commit -m "feat(listening): authoring validator (4x10 shape, keys, voices, markers, dedup)"
```

### Task 7: Hub UI — level-grouped Luyện Nghe

**Files:**
- Create: `web/src/lib/listening-ui.ts`
- Modify: `web/src/app/(app)/listening/page.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `ListeningSet.level` (Task 1).
- Produces: `LEVEL_ORDER: CefrLevel[]`, `LEVEL_META: Record<CefrLevel, { labelVi: string; badgeClass: string }>` — also consumed by Task 8's set page.

- [ ] **Step 1: Create `web/src/lib/listening-ui.ts`**

```ts
import type { CefrLevel } from "@prisma/client";

export const LEVEL_ORDER: CefrLevel[] = ["A2", "B1", "B2", "C1"];

/** Vietnamese labels + badge styling per CEFR level (semantic tokens only,
 * so dark mode works untouched). */
export const LEVEL_META: Record<CefrLevel, { labelVi: string; badgeClass: string }> = {
  A2: { labelVi: "Sơ cấp", badgeClass: "bg-success-bg text-success" },
  B1: { labelVi: "Trung cấp", badgeClass: "bg-primary/10 text-primary" },
  B2: { labelVi: "Trung cao cấp", badgeClass: "bg-accent/15 text-accent" },
  C1: { labelVi: "Cao cấp", badgeClass: "bg-destructive/10 text-destructive" },
};
```

- [ ] **Step 2: Rewrite `web/src/app/(app)/listening/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CefrLevel } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/EmptyState";
import { LEVEL_META, LEVEL_ORDER } from "@/lib/listening-ui";
import { cn } from "@/lib/utils";

function formatDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return `~${m} phút`;
}

export default async function ListeningHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Only PRACTICE-kind sets are browsable here — PLACEMENT sets are consumed
  // exclusively through the onboarding placement wizard.
  const sets = await db.listeningSet.findMany({
    where: { kind: "PRACTICE" },
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      title: true,
      durationSec: true,
      level: true,
      sections: { select: { _count: { select: { questions: true } } } },
    },
  });

  const groups: { level: CefrLevel | null; sets: typeof sets }[] = [
    ...LEVEL_ORDER.map((level) => ({
      level: level as CefrLevel | null,
      sets: sets.filter((s) => s.level === level),
    })),
    // Defensive bucket for PRACTICE sets missing a level (seed WARNs on these).
    { level: null, sets: sets.filter((s) => s.level === null) },
  ].filter((g) => g.sets.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Luyện nghe</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Chọn bài nghe theo cấp độ. Mỗi bài gồm 4 phần với 40 câu hỏi — hoàn thành từng phần để mở
        khóa lời thoại.
      </p>

      {sets.length === 0 ? (
        <EmptyState icon="🎧" title="Chưa có bài nghe nào" description="Quay lại sau để luyện nghe nhé." />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.level ?? "other"}>
              <div className="mb-3 flex items-center gap-2">
                {group.level ? (
                  <>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", LEVEL_META[group.level].badgeClass)}>
                      {group.level}
                    </span>
                    <h2 className="font-semibold">{LEVEL_META[group.level].labelVi}</h2>
                  </>
                ) : (
                  <h2 className="font-semibold">Khác</h2>
                )}
                <span className="text-caption text-muted-foreground">· {group.sets.length} bài</span>
              </div>
              <div className="flex flex-col gap-3">
                {group.sets.map((set) => {
                  const qCount = set.sections.reduce((n, s) => n + s._count.questions, 0);
                  return (
                    <Link
                      key={set.slug}
                      href={`/listening/${set.slug}`}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
                        🎧
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{set.title}</p>
                        <p className="text-caption text-muted-foreground">
                          {qCount} câu{set.durationSec ? ` · ${formatDuration(set.durationSec)}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd web && npm run lint && npm run build` — Expected: clean. Then `npm run dev`, open `http://localhost:3000/listening`: the 2 existing sets appear under "Khác" (they get levels in Tasks 10–11).

- [ ] **Step 4: Commit**

```bash
git add src/lib/listening-ui.ts "src/app/(app)/listening/page.tsx"
git commit -m "feat(listening): level-grouped hub with CEFR badges and question counts"
```

### Task 8: Sectioned runner (page → runner → view)

**Files:**
- Modify: `web/src/components/ListeningRunner.tsx` (full rewrite below)
- Modify: `web/src/components/ListeningSetView.tsx` (full rewrite below)
- Modify: `web/src/app/(app)/listening/[slug]/page.tsx` (full rewrite below)
- Modify: `web/src/lib/listening.ts` (delete now-unused `getOrderedListeningQuestions`; keep `OrderedListeningQuestion` + `getOrderedListeningSections`)

**Interfaces:**
- Consumes: `getOrderedListeningSections` (existing, `web/src/lib/listening.ts:53`), `transcriptChunksForSections` (Task 4), section helpers (Task 5), `LEVEL_META` (Task 7), `SafeQuestion` (existing, `web/src/components/runner/QuestionCard.tsx:25`), `runnerReducer`/`initRunnerState` (existing, untouched), check API (existing, untouched).
- Produces: `export interface SafeListeningSection { label: string; title: string; instructions: string | null; questions: SafeQuestion[] }` (exported from `ListeningRunner.tsx`); `ListeningRunner({ slug, sections, onSectionComplete?, onFinished })`; `ListeningSetView({ slug, audioUrl, transcriptMd, sections })`.
- Behavior: strictly sequential retry-until-correct flow is unchanged (stepper is display-only); transcript unlocks per completed section when the transcript splits cleanly, else falls back to the current all-questions gate (placement/TOEIC "Part N" content).

- [ ] **Step 1: Rewrite `web/src/components/ListeningRunner.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initRunnerState, runnerReducer } from "@/components/runner/reducer";
import { QuestionCard, type SafeQuestion } from "@/components/runner/QuestionCard";
import { ExplanationSlot } from "@/components/runner/ExplanationSlot";
import {
  completedSectionCount,
  questionIndexInSection,
  sectionIndexForQuestion,
  sectionStartIndexes,
} from "@/components/runner/sections";

export interface SafeListeningSection {
  label: string;
  title: string;
  instructions: string | null;
  questions: SafeQuestion[];
}

/**
 * Question-answering flow for a listening set, rendered as "Phần 1..N"
 * sections over the same flat forward-only reducer as before (reducer and
 * the stateless POST /api/listening/[slug]/check are untouched). The section
 * stepper is display-only: free section jumping would break the
 * retry-until-correct completion invariant that gates transcript unlock.
 * `onSectionComplete(i)` fires once per section, in order, so the parent can
 * unlock that section's transcript chunk.
 */
export function ListeningRunner({
  slug,
  sections,
  onSectionComplete,
  onFinished,
}: {
  slug: string;
  sections: SafeListeningSection[];
  onSectionComplete?: (sectionIndex: number) => void;
  onFinished: () => void;
}) {
  const flat = useMemo(() => sections.flatMap((s) => s.questions), [sections]);
  const counts = useMemo(() => sections.map((s) => s.questions.length), [sections]);

  const [state, dispatch] = useReducer(runnerReducer, undefined, () =>
    initRunnerState(
      flat.map((q) => q.id),
      0,
    ),
  );

  // Strict-mode-safe: remembers how many sections were already reported.
  const reportedRef = useRef(0);
  useEffect(() => {
    const done = completedSectionCount(counts, state.index, state.phase === "finished");
    for (let s = reportedRef.current; s < done; s++) onSectionComplete?.(s);
    reportedRef.current = Math.max(reportedRef.current, done);
    if (state.phase === "finished") onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on progress transitions, not callback identity changes
  }, [state.index, state.phase]);

  if (flat.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài nghe này chưa có câu hỏi.
      </p>
    );
  }

  const total = flat.length;
  const question = flat[state.index];

  async function handleSubmit() {
    if (state.phase !== "answering" && state.phase !== "incorrect") return;
    if (state.input.trim() === "") return;

    const answerText = state.input;
    dispatch({ type: "SUBMIT" });

    const res = await fetch(`/api/listening/${slug}/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: question.id, answerText }),
    });
    const json = await res.json();
    dispatch({ type: "RESULT", result: json });
  }

  if (state.phase === "finished") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/50 bg-success-bg p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-lg font-bold">Hoàn thành cả {sections.length} phần!</h2>
        <p className="text-sm text-muted-foreground">Bây giờ bạn có thể xem toàn bộ lời thoại.</p>
      </div>
    );
  }

  if (!question) return null;

  const sIdx = sectionIndexForQuestion(counts, state.index);
  const qInSection = questionIndexInSection(counts, state.index);
  const section = sections[sIdx];
  const percent = Math.round((state.index / total) * 100);
  const isChecking = state.phase === "checking";
  const isIncorrect = state.phase === "incorrect";
  const isCorrect = state.phase === "correct";

  return (
    <div className="flex flex-col gap-4">
      <SectionStepper sections={sections} counts={counts} flatIndex={state.index} />

      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-caption font-bold tracking-wide text-primary">
          PHẦN {sIdx + 1}/{sections.length}
        </p>
        <p className="mt-0.5 font-semibold">{section.title}</p>
        {section.instructions && (
          <p className="mt-1 text-sm text-muted-foreground">{section.instructions}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Phần {sIdx + 1} · Câu {qInSection + 1}/{counts[sIdx]}
          </span>
          <span className="flex items-center gap-3">
            {isIncorrect && <span>Lần thử: {state.tries}</span>}
            <span>
              Tổng: {state.index + 1}/{total}
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary animate-progress-fill transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border p-5 transition-colors",
          isIncorrect && "border-destructive/50 bg-destructive/5",
          isCorrect && "border-success/50 bg-success-bg",
          !isIncorrect && !isCorrect && "border-border bg-card",
        )}
      >
        <QuestionCard
          key={question.id}
          question={question}
          status={state.phase}
          disabled={isChecking || isCorrect}
          onChangeInput={(value) => dispatch({ type: "SET_INPUT", value })}
        />

        {isIncorrect && (
          <div className="mt-3">
            <p className="text-sm font-medium text-destructive">Chưa đúng, thử lại.</p>
            <ExplanationSlot explanation={state.result?.explanation ?? null} />
          </div>
        )}

        {isCorrect && (
          <div className="mt-3 text-sm">
            <p className="font-medium text-success">Chính xác!</p>
            {state.result?.correctAnswer && (
              <p className="text-muted-foreground">
                Đáp án: <span className="font-medium text-foreground">{state.result.correctAnswer}</span>
              </p>
            )}
            {state.result?.keyNote && <p className="text-muted-foreground">{state.result.keyNote}</p>}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          {isCorrect ? (
            <Button onClick={() => dispatch({ type: "CONTINUE" })}>Tiếp tục</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isChecking || state.input.trim() === ""}>
              {isIncorrect ? "Thử lại" : "Kiểm tra"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionStepper({
  sections,
  counts,
  flatIndex,
}: {
  sections: SafeListeningSection[];
  counts: number[];
  flatIndex: number;
}) {
  const starts = sectionStartIndexes(counts);
  const current = sectionIndexForQuestion(counts, flatIndex);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Tiến độ các phần">
      {sections.map((_, i) => {
        const answered = Math.min(Math.max(flatIndex - starts[i], 0), counts[i]);
        const done = answered >= counts[i];
        const isCurrent = i === current && !done;
        return (
          <li
            key={i}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              done && "bg-success-bg text-success",
              isCurrent && "bg-primary text-primary-foreground",
              !done && !isCurrent && "bg-muted text-muted-foreground",
            )}
          >
            <span>Phần {i + 1}</span>
            <span className={cn(!isCurrent && !done && "opacity-70")}>
              {done ? "✓" : `${answered}/${counts[i]}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Rewrite `web/src/components/ListeningSetView.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ListeningRunner, type SafeListeningSection } from "@/components/ListeningRunner";
import { transcriptChunksForSections } from "@/lib/transcript";

const TRANSCRIPT_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;

const SPEAKER_PALETTE = ["text-primary", "text-accent"];

function TranscriptBody({ transcriptMd }: { transcriptMd: string }) {
  const lines = transcriptMd.split("\n").filter((l) => l.trim().length > 0);
  const speakerColor = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(TRANSCRIPT_LINE_RE);
    if (m && !speakerColor.has(m[1])) {
      speakerColor.set(m[1], SPEAKER_PALETTE[speakerColor.size % SPEAKER_PALETTE.length]);
    }
  }
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const m = line.match(TRANSCRIPT_LINE_RE);
        if (!m) return <p key={i}>{line}</p>;
        return (
          <p key={i}>
            <span className={cn("font-semibold", speakerColor.get(m[1]) ?? "text-foreground")}>
              {m[1]}:
            </span>{" "}
            <span className="text-muted-foreground">{m[2]}</span>
          </p>
        );
      })}
    </div>
  );
}

function LockedNote({ label }: { label: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-3.5 shrink-0" />
      {label}
    </p>
  );
}

/**
 * Client-side glue for `/listening/[slug]`: sticky AudioPlayer above the
 * sectioned runner. Transcript unlock is per completed section when the
 * transcript splits cleanly on "NARRATOR: Section N." markers
 * (transcriptChunksForSections); otherwise (legacy/TOEIC "Part N" content)
 * it falls back to the previous all-questions gate.
 */
export function ListeningSetView({
  slug,
  audioUrl,
  transcriptMd,
  sections,
}: {
  slug: string;
  audioUrl: string;
  transcriptMd: string;
  sections: SafeListeningSection[];
}) {
  const [sectionsDone, setSectionsDone] = useState(0);
  const chunks = useMemo(
    () => transcriptChunksForSections(transcriptMd, sections.length),
    [transcriptMd, sections.length],
  );
  const allDone = sectionsDone >= sections.length;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <AudioPlayer src={audioUrl} variant="full" />

        <ListeningRunner
          slug={slug}
          sections={sections}
          onSectionComplete={(i) => setSectionsDone((c) => Math.max(c, i + 1))}
          onFinished={() => setSectionsDone(sections.length)}
        />

        {/* Mobile: accordion(s) below the runner */}
        {chunks ? (
          <div className="flex flex-col gap-3 lg:hidden">
            {chunks.map((chunk, i) => {
              const unlocked = sectionsDone > i;
              return (
                <details key={i} className="group rounded-xl border border-border bg-card">
                  <summary
                    onClick={(e) => {
                      if (!unlocked) e.preventDefault();
                    }}
                    className={cn(
                      "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
                      unlocked ? "hover:bg-muted/50" : "cursor-not-allowed text-muted-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {!unlocked && <Lock className="size-3.5" />}
                      <span>Lời thoại — Phần {i + 1}</span>
                      {!unlocked && (
                        <span className="font-normal text-muted-foreground">
                          (hoàn thành Phần {i + 1} để mở khóa)
                        </span>
                      )}
                    </span>
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  {unlocked && (
                    <div className="border-t border-border px-4 py-4">
                      <TranscriptBody transcriptMd={chunk} />
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        ) : (
          <details className="group rounded-xl border border-border bg-card lg:hidden">
            <summary
              onClick={(e) => {
                if (!allDone) e.preventDefault();
              }}
              className={cn(
                "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
                allDone ? "hover:bg-muted/50" : "cursor-not-allowed text-muted-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                {!allDone && <Lock className="size-3.5" />}
                <span>Xem lời thoại</span>
                {!allDone && (
                  <span className="font-normal text-muted-foreground">(hoàn thành câu hỏi để mở khóa)</span>
                )}
              </span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            {allDone && (
              <div className="border-t border-border px-4 py-4">
                <TranscriptBody transcriptMd={transcriptMd} />
              </div>
            )}
          </details>
        )}
      </div>

      {/* Desktop: sticky aside */}
      <aside className="sticky top-8 hidden max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 lg:block">
        <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">📄 LỜI THOẠI</p>
        {chunks ? (
          <div className="flex flex-col gap-4">
            {chunks.map((chunk, i) =>
              sectionsDone > i ? (
                <div key={i}>
                  <p className="mb-1 text-caption font-bold text-muted-foreground">Phần {i + 1}</p>
                  <TranscriptBody transcriptMd={chunk} />
                </div>
              ) : (
                <LockedNote key={i} label={`Phần ${i + 1}: hoàn thành để mở khóa.`} />
              ),
            )}
          </div>
        ) : allDone ? (
          <TranscriptBody transcriptMd={transcriptMd} />
        ) : (
          <LockedNote label="Hoàn thành câu hỏi để mở khóa lời thoại." />
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `web/src/app/(app)/listening/[slug]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getOrderedListeningSections } from "@/lib/listening";
import { ListeningSetView } from "@/components/ListeningSetView";
import type { SafeListeningSection } from "@/components/ListeningRunner";
import { LEVEL_META } from "@/lib/listening-ui";
import { cn } from "@/lib/utils";

export default async function ListeningSetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await params;

  const listeningSet = await db.listeningSet.findUnique({ where: { slug } });
  if (!listeningSet) notFound();

  // Prompts/options only — never `answerRaw`/`variants` (same "answer keys
  // never reach the client" rule as the lesson exercise RSC page).
  const sections = await getOrderedListeningSections(listeningSet.id);
  const safeSections: SafeListeningSection[] = sections.map((s) => ({
    label: s.label,
    title: s.title,
    instructions: s.instructions,
    questions: s.questions.map((q) => ({
      id: q.id,
      number: q.number,
      prompt: q.prompt,
      options: q.options as { label: string; text: string }[] | null,
      imageUrl: q.imageUrl,
      kind: q.kind,
      isOpenEnded: q.isOpenEnded,
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:max-w-5xl">
      <Link
        href="/listening"
        className="mb-4 inline-block text-caption text-muted-foreground hover:text-foreground"
      >
        ← Quay lại luyện nghe
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-h1 font-bold">{listeningSet.title}</h1>
        {listeningSet.level && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold",
              LEVEL_META[listeningSet.level].badgeClass,
            )}
          >
            {listeningSet.level} · {LEVEL_META[listeningSet.level].labelVi}
          </span>
        )}
      </div>

      <ListeningSetView
        slug={listeningSet.slug}
        audioUrl={listeningSet.audioUrl}
        transcriptMd={listeningSet.transcriptMd}
        sections={safeSections}
      />
    </div>
  );
}
```

- [ ] **Step 4: Remove the now-unused flat helper**

In `web/src/lib/listening.ts`: first confirm the only consumer was the page just rewritten — run `grep -rn "getOrderedListeningQuestions" web/src web/scripts`. Expected: no remaining callers. Then delete the `getOrderedListeningQuestions` function (KEEP `OrderedListeningQuestion` — `ListeningSectionWithQuestions` uses it — and KEEP `getOrderedListeningSections`), and reword its mention in the doc comment of `getOrderedListeningSections` accordingly. If `web/src/lib/placement.ts` line ~24 references `getOrderedListeningQuestions` in a comment, update that comment to say `getOrderedListeningSections`.

- [ ] **Step 5: Verify against EXISTING content (still 2-section sets)**

```bash
cd web
npm test          # transcript/sections/parse/check suites all green
npm run lint && npm run build
npm run dev
```

Open `http://localhost:3000/listening/practice_01`: stepper shows `Phần 1 (0/5)` `Phần 2 (0/5)`; answering all of Phần 1 flips its pill to ✓ and unlocks `Lời thoại — Phần 1` (its transcript has one `NARRATOR: Section 1.` marker per section — if it has only 1 marker for 2 sections, the fallback single gate must appear instead; either behavior is correct, the point is: no crash, gating consistent). Everything is `sections.length`-generic — no assumption of 4 sections or 40 questions.

- [ ] **Step 6: Commit**

```bash
git add src/components/ListeningRunner.tsx src/components/ListeningSetView.tsx "src/app/(app)/listening/[slug]/page.tsx" src/lib/listening.ts src/lib/placement.ts
git commit -m "feat(listening): sectioned runner with per-section transcript unlock"
```

### Task 9: Platform wrap-up gate

**Files:** none (verification only)

- [ ] **Step 1: Full check**

```bash
cd web && npm test && npm run lint && npm run build
```

Expected: all green. `parse-listening.test.ts`'s real-file assertions still target `practice_01.md` (2 sections, 5+5) and still pass — they are updated in Task 10 when the file is renamed.

- [ ] **Step 2: Fix anything that surfaced, commit fixes if any**

```bash
git add -A && git commit -m "chore(listening): platform-phase fixups" # only if changes exist
```

---

# PHASE B — Content (Tasks 10–16)

## The 14-set matrix (single source of truth for authoring)

Voice shorthand (full edge-tts names): Guy=`en-US-GuyNeural`, Jenny=`en-US-JennyNeural`, Aria=`en-US-AriaNeural`, Christopher=`en-US-ChristopherNeural`, Eric=`en-US-EricNeural`, Michelle=`en-US-MichelleNeural`, Ryan=`en-GB-RyanNeural`, Sonia=`en-GB-SoniaNeural`, Libby=`en-GB-LibbyNeural`, Thomas=`en-GB-ThomasNeural`, Natasha=`en-AU-NatashaNeural`, William=`en-AU-WilliamNeural`. **NARRATOR is always Jenny; never assign Jenny to a character.** Guy/Jenny/Aria/Ryan/Sonia/Natasha/William are already proven in this repo; before first use of Christopher/Eric/Michelle/Libby/Thomas, verify availability (Task 10 Step 1) and substitute from the proven seven if missing.

Speakers per set: S1 = A+B (transactional conversation), S2 = C (monologue/announcement/tour), S3 = D+E (discussion/interview), S4 = F (lecture/talk). Kind per section: `F` = FILL IN THE BLANK, `M` = MULTIPLE CHOICE.

| # | Slug | Level | Title (front matter) | Section blueprint (format — topic — kind) | Voices A,B / C / D,E / F | Speech words / pause budget / target |
|---|------|-------|----------------------|--------------------------------------------|--------------------------|--------------------------------------|
| 1 | `practice_a2_01` | A2 | "Practice Listening: Sports and Leisure" | S1 conv — booking a child's swimming course (**existing content, kept & extended**) — F · S2 announcement — pool timetable & rules — M · S3 conv — friends arrange badminton + equipment hire — M · S4 talk — coach's advice for new swimmers — F | Guy,Sonia / Natasha / Ryan,Aria / William | ~1,800 w / 140 s / 15–18 min |
| 2 | `practice_a2_02` | A2 | "Practice Listening: At the Library" | S1 conv — library membership (**existing content, kept & extended**; retitled from "Placement Listening: Joining a Public Library") — F · S2 announcement — children's reading-week events — M · S3 conv — two students find project books & e-books — M · S4 talk — how the book donation drive works — F | Ryan,Aria / Michelle / Guy,Libby / Thomas | ~1,800 w / 140 s / 15–18 min |
| 3 | `practice_a2_03` | A2 | "Practice Listening: A New Apartment" | S1 conv — arranging a flat viewing (rent, address, dates) — F · S2 talk — building manager's welcome (bins, parking, laundry) — M · S3 conv — flatmates plan furniture shopping — M · S4 talk — tips to lower the electricity bill — F | Thomas,Michelle / Sonia / William,Aria / Eric | ~1,800 w / 140 s / 15–18 min |
| 4 | `practice_a2_04` | A2 | "Practice Listening: Food and Cooking" | S1 conv — restaurant booking + birthday cake order — F · S2 talk — cooking class welcome — M · S3 conv — friends plan a picnic menu — F · S4 talk — how the farmers' market works — M | Eric,Libby / William / Sonia,Christopher / Natasha | ~1,800 w / 140 s / 15–18 min |
| 5 | `practice_a2_05` | A2 | "Practice Listening: Getting Around Town" | S1 conv — bus information line (times, fares, lost property) — F · S2 announcement — weekend timetable changes at the station — F · S3 conv — visitors plan a day trip by tram — M · S4 talk — the city bike-share scheme — M | Christopher,Natasha / Ryan / Michelle,Thomas / Sonia | ~1,800 w / 140 s / 15–18 min |
| 6 | `practice_b1_01` | B1 | "Practice Listening: Working Life" | S1 conv — part-time café job phone screening — F · S2 talk — first-day office orientation — M · S3 conv — colleagues plan a farewell gift & party — M · S4 talk — careers adviser on CV writing — F | Guy,Sonia / Natasha / Ryan,Aria / Thomas | ~2,400 w / 180 s / 19–22 min |
| 7 | `practice_b1_02` | B1 | "Practice Listening: Health and Wellbeing" | S1 conv — registering at a dental clinic — F · S2 monologue — flu clinic recorded information line — M · S3 conv — friends plan training for a charity 10K — M · S4 talk — nutritionist on sugar in everyday food — F | Thomas,Michelle / Eric / Natasha,Guy / Libby | ~2,400 w / 180 s / 19–22 min |
| 8 | `practice_b1_03` | B1 | "Practice Listening: Travel and Holidays" | S1 conv — guesthouse booking with special requests — F · S2 announcement — ferry terminal boarding briefing — F · S3 conv — couple compares two holiday packages — M · S4 talk — tour guide on trekking safety — M | William,Libby / Aria / Christopher,Sonia / Guy | ~2,400 w / 180 s / 19–22 min |
| 9 | `practice_b2_01` | B2 | "Practice Listening: University Life" | S1 conv — admissions call about changing course modules — F · S2 talk — student services on accommodation options — M · S3 conv — tutor & student discuss a dissertation topic — M · S4 lecture — how memory works: study techniques — F | Aria,Ryan / Sonia / Guy,Natasha / Christopher | ~3,000 w / 235 s / 23–27 min |
| 10 | `practice_b2_02` | B2 | "Practice Listening: City and Environment" | S1 conv — reporting a missed recycling collection to the council — F · S2 tour — ranger's talk at a wetland reserve — M · S3 discussion — residents debate a car-free Sunday — M · S4 lecture — urban heat islands — F | Sonia,Eric / William / Libby,Christopher / Natasha | ~3,000 w / 235 s / 23–27 min |
| 11 | `practice_b2_03` | B2 | "Practice Listening: Media and Technology" | S1 conv — broadband support call, router setup appointment — F · S2 monologue — podcast producer explains episode production — F · S3 conv — friends debate a social-media detox — M · S4 lecture — history of radio broadcasting — M | Michelle,Thomas / Guy / Natasha,Ryan / Sonia | ~3,000 w / 235 s / 23–27 min |
| 12 | `practice_c1_01` | C1 | "Practice Listening: Science and Research" | S1 conv — screening call to join a university sleep study — F · S2 briefing — observatory stargazing-night visitor briefing — M · S3 discussion — two researchers critique an experiment design (replication) — M · S4 lecture — the human microbiome — F | Ryan,Aria / Christopher / Sonia,William / Thomas | ~3,650 w / 310 s / 28–32 min |
| 13 | `practice_c1_02` | C1 | "Practice Listening: Business and Economy" | S1 conv — opening a small-business bank account — F · S2 briefing — conference welcome & logistics — F · S3 interview — radio interview with a startup founder — M · S4 lecture — behavioural economics: nudges — M | Guy,Libby / Natasha / Michelle,Ryan / Eric | ~3,650 w / 310 s / 28–32 min |
| 14 | `practice_c1_03` | C1 | "Practice Listening: Arts and Culture" | S1 conv — booking a theatre workshop for a school group — F · S2 tour — opera house backstage tour introduction — M · S3 discussion — two critics discuss a film adaptation — M · S4 lecture — the psychology of music — F | Sonia,Christopher / Thomas / Aria,William / Natasha | ~3,650 w / 310 s / 28–32 min |

**Pause budgets per section** (NARRATOR intro `[PAUSE:<look>]` to read questions + outro `[PAUSE:<check>]` to check answers): A2 = 20+15 s; B1 = 25+20 s; B2 = 30+25 s plus one `[PAUSE:15]` mid-S3 (split "questions 26 to 30"); C1 = 40+30 s plus one `[PAUSE:15]` mid-S3 and mid-S4. Word budgets assume ~150 wpm + 0.4 s/turn — **calibrate against Task 10's real ffprobe result and adjust remaining sets ±10%.**

**Dedup rules:** every topic above is distinct set-to-set and distinct from the placement sets. Known adjacency to steer around: `placement_ielts` Section 1 is also a leisure-centre-style signup — when extending `practice_a2_01` S1, keep it strictly about the child's swimming course (existing content) and pick S2–S4 facts (names, prices, times, places) that appear nowhere else. The corpus similarity check (Task 6) warns at >0.30 on PRACTICE pairs; titles must be globally unique.

## Authoring template (structural contract — validator-enforced)

Complete skeleton showing all conventions; Section 1 shown in full, Sections 2–4 follow the identical pattern with their own format/topic/kind from the matrix:

```markdown
---
slug: practice_b1_01
title: "Practice Listening: Working Life"
kind: PRACTICE
level: B1
voices: { A: en-US-GuyNeural, B: en-GB-SoniaNeural, C: en-AU-NatashaNeural, D: en-GB-RyanNeural, E: en-US-AriaNeural, F: en-GB-ThomasNeural, NARRATOR: en-US-JennyNeural }
---
## TRANSCRIPT
NARRATOR: Section 1. You will hear a telephone conversation between a student and a café manager about a part-time job. First, you have some time to look at questions 1 to 10.
[PAUSE:25]
B: Good morning, Beanhouse Café, this is Sarah speaking. How can I help you?
A: Oh hello, I'm calling about the part-time barista position you advertised.
B: Great! Could I take your name first?
A: Yes, it's Minh Tran. That's T, R, A, N.
B: Thank you. And are you available on Saturday mornings? That's our busiest shift.
A: Saturdays are fine. How much does the position pay?
B: It starts at nine pounds fifty an hour, rising after three months.
... (natural conversation continues — answers for Q1–10 appear IN ORDER, ~600 words total for B1) ...
NARRATOR: That is the end of Section 1. You now have some time to check your answers.
[PAUSE:20]
NARRATOR: Section 2. You will hear a talk given to new employees on their first day at an office. First, you have some time to look at questions 11 to 20.
[PAUSE:25]
C: Welcome, everyone, to your first day at Harker and Miles. ... (~600-word monologue) ...
NARRATOR: That is the end of Section 2. You now have some time to check your answers.
[PAUSE:20]
NARRATOR: Section 3. ... (same pattern, speakers D and E) ...
NARRATOR: Section 4. ... (same pattern, speaker F) ...
NARRATOR: That is the end of Section 4, and the end of the listening practice.
[PAUSE:10]
## QUESTIONS
## SECTION 1: FILL IN THE BLANK (Điền vào chỗ trống)
Complete the notes. Write ONE WORD AND/OR A NUMBER for each answer. (Điền tối đa MỘT từ và/hoặc MỘT số cho mỗi câu.)
1. The applicant's surname is ______ .
2. The café needs staff on ______ mornings.
3. The starting pay is £______ per hour.
4. ...
10. Interviews take place on the ______ of June.

## SECTION 2: MULTIPLE CHOICE (Trắc nghiệm)
Choose the correct answer. (Chọn đáp án đúng.)
11. Where should new employees collect their security pass?
- A) At reception
- B) From the HR office
- C) From their line manager
- D) At the security desk
12. ...
20. ...

## SECTION 3: MULTIPLE CHOICE (Trắc nghiệm)
21. ... (21–30)

## SECTION 4: FILL IN THE BLANK (Điền vào chỗ trống)
31. ... (31–40)

## ANSWER KEY (ĐÁP ÁN)
### Section 1:
1. Tran
2. Saturday
3. 9.50 / nine fifty
...
### Section 2:
11. B (from the HR office)
...
### Section 4:
40. 30 / thirty
```

**Authoring rules** (rule → enforcement):
1. `slug` == filename; `level` required; every transcript speaker mapped in `voices`; never give a character the NARRATOR's voice (Jenny). *(validator, except the Jenny rule — matrix enforces it)*
2. Exactly 4 `## SECTION N:` sections × 10 questions, numbered 1–40 globally ascending; key headers `### Section N:`. *(validator)*
3. Section titles exactly `FILL IN THE BLANK (Điền vào chỗ trống)` or `MULTIPLE CHOICE (Trắc nghiệm)`. *(validator: kind check)*
4. Optional instruction line(s) between the section heading and its first question become `Section.instructions` (shown in the runner's section header).
5. FILL: exactly one `______` per question; answers ≤ 3 words; alternates `/`-separated (`45 / forty-five`); answers occur in the transcript in question order.
6. MCQ: 3–4 options as `- A) text`; key line `11. B (short justification)` — the parenthetical becomes `keyNote`.
7. Every section opens `NARRATOR: Section N. …` and closes with a narrator outro that does NOT begin "NARRATOR: Section". *(validator: marker count)*
8. `[PAUSE:n]` alone on its own line, per the level's pause budget. *(validator: WARN outside [90,600]s total or >60s single)*
9. No `![](...)` images in practice sets — audio-only.
10. All distractor MCQ options must be plausible and mentioned/implied in the audio; correct answers must be unambiguous from the audio alone.

### Task 10: Upgrade `practice_01` → `practice_a2_01` (calibration set)

**Files:**
- Rename: `web/content/listening/practice_01.md` → `web/content/listening/practice_a2_01.md`
- Delete: `web/public/audio/listening/practice_01.mp3`
- Create: `web/public/audio/listening/practice_a2_01.mp3` (generated)
- Modify: `web/scripts/seed/parse-listening.test.ts` (real-file assertions)

**Interfaces:**
- Consumes: matrix row 1, authoring template, validator (Task 6), TTS pipeline (`web/scripts/tts/generate_audio.py`).
- Produces: the calibration datapoint — real ffprobe duration vs `estimateAudioSeconds` — used to tune word budgets for Tasks 11–15.

- [ ] **Step 1: One-time voice availability check (covers ALL sets)**

```bash
cd web/scripts/tts && source .venv/bin/activate
edge-tts --list-voices | grep -E "en-(US|GB|AU)-(Guy|Jenny|Aria|Christopher|Eric|Michelle|Ryan|Sonia|Libby|Thomas|Natasha|William)Neural"
```

Expected: 12 lines. If any of Christopher/Eric/Michelle/Libby/Thomas is missing, substitute a same-accent proven voice (Guy/Aria ↔ US, Ryan/Sonia ↔ GB, Natasha/William ↔ AU) in the matrix rows that use it, keeping every set's 6 character voices distinct.

- [ ] **Step 2: Rename and rewrite the content file**

```bash
cd /home/ncd/learnspaces/learning_english
git mv web/content/listening/practice_01.md web/content/listening/practice_a2_01.md
git rm web/public/audio/listening/practice_01.mp3
```

Rewrite `practice_a2_01.md` per matrix row 1 + template:
- Front matter: `slug: practice_a2_01`, `title: "Practice Listening: Sports and Leisure"`, `kind: PRACTICE`, `level: A2`, voices per matrix (A Guy, B Sonia, C Natasha, D Ryan, E Aria, F William, NARRATOR Jenny).
- **Section 1 (Q1–10, FILL):** keep the existing swimming-course conversation and its 5 FILL answers (Parker / seven / Saturday / 45 / swimming cap) as Q1–5 verbatim; EXTEND the same conversation (~250 more words: locker rules, what to bring, instructor's name, start date, contact number) to supply new Q6–10. The old file's 5 MCQs are retired (their facts may only reappear if re-contextualized).
- **Sections 2–4 (Q11–40):** author fresh per the blueprint — S2 announcement pool timetable & rules (M), S3 friends arrange badminton + equipment hire (M), S4 coach's advice for new swimmers (F) — with narrator markers, `[PAUSE:20]`/`[PAUSE:15]` per section, ~450 speech words per section (A2 total ~1,800).

- [ ] **Step 3: Update the real-file test assertions**

In `web/scripts/seed/parse-listening.test.ts`, the block that reads `content/listening/practice_01.md` and asserts 2 sections / 5+5 questions: point it at `practice_a2_01.md` and assert the new shape:

```ts
    expect(parsed.frontMatter.slug).toBe("practice_a2_01");
    expect(parsed.frontMatter.level).toBe("A2");
    expect(parsed.questions.sections).toHaveLength(4);
    expect(parsed.questions.sections.reduce((n, s) => n + s.questions.length, 0)).toBe(40);
```

Run: `cd web && npm test` — Expected: PASS.

- [ ] **Step 4: Validate, generate, calibrate**

```bash
cd web
npm run seed:validate-listening        # practice_a2_01 must be ERROR-free (mp3 WARN ok)
source scripts/tts/.venv/bin/activate
python scripts/tts/generate_audio.py content/listening/practice_a2_01.md --dry-run
python scripts/tts/generate_audio.py content/listening/practice_a2_01.md    # ~5–15 min
ffprobe -v error -show_entries format=duration -of csv=p=0 public/audio/listening/practice_a2_01.mp3
```

Expected duration: 900–1080 s (15–18 min). **Calibration:** compare against the validator's `est≈` figure; if real/estimated ratio is outside 0.9–1.1, scale the remaining sets' word budgets by that ratio (note the ratio in the commit message).

- [ ] **Step 5: Seed and spot-check**

```bash
npm run seed -- --dry-run   # expect: "would prune listening set(s): practice_01"
npm run seed
```

Open `http://localhost:3000/listening` — set now under badge `A2 · Sơ cấp`; open it: 4-pill stepper, `40 câu`, per-section transcript unlock works end-to-end (answer all of Phần 1 → `Lời thoại — Phần 1` unlocks).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "content(listening): practice_a2_01 — Sports and Leisure, 40q A2 (upgraded from practice_01)"
```

### Task 11: Upgrade `placement_01` → `practice_a2_02`

**Files:**
- Rename: `web/content/listening/placement_01.md` → `web/content/listening/practice_a2_02.md`
- Delete: `web/public/audio/listening/placement_01.mp3`
- Create: `web/public/audio/listening/practice_a2_02.mp3` (generated)

Same procedure as Task 10 (no test-file changes needed):

- [ ] **Step 1:** `git mv web/content/listening/placement_01.md web/content/listening/practice_a2_02.md && git rm web/public/audio/listening/placement_01.mp3`
- [ ] **Step 2:** Rewrite per matrix row 2: `slug: practice_a2_02`, retitle to `"Practice Listening: At the Library"` (drops the stale "Placement Listening" title), `level: A2`, voices per matrix. Keep the existing library-membership conversation as Section 1 (reuse its FILL answers as Q1–5, extend the conversation for Q6–10; retire its old MCQs), author S2–S4 fresh per blueprint (reading-week events M, project books & e-books M, book donation drive F).
- [ ] **Step 3:** Validate → dry-run → generate → ffprobe (expect 900–1080 s, apply Task 10's calibration) → `npm run seed` (dry run first: `would prune listening set(s): placement_01`).
- [ ] **Step 4:** Browser check: hub shows `A2 · Sơ cấp · 2 bài`; old URL `/listening/placement_01` now 404s (acceptable pre-launch, row pruned).
- [ ] **Step 5:** Commit: `content(listening): practice_a2_02 — At the Library, 40q A2 (retired placement_01 slug)`.

### Task 12: Author the A2 batch — `practice_a2_03`, `practice_a2_04`, `practice_a2_05`

**Files (per set):**
- Create: `web/content/listening/<slug>.md`
- Create: `web/public/audio/listening/<slug>.mp3` (generated)

For EACH of the three sets (matrix rows 3–5), one commit per set:

- [ ] **Step 1: Author** `<slug>.md` per its matrix row + template: A2 language (short sentences, everyday vocabulary, ~1,800 speech words adjusted by Task 10's calibration ratio), pauses 20+15 per section, all 40 answers objective and transcript-ordered.
- [ ] **Step 2: Validate:** `npm run seed:validate-listening` → the new file reports `OK`/mp3-WARN only, and NO corpus similarity warning against any other set.
- [ ] **Step 3: Generate:** `python scripts/tts/generate_audio.py content/listening/<slug>.md --dry-run` (checks voice mapping) then without `--dry-run`. Do not run more than 2–3 generations concurrently (edge-tts throttling).
- [ ] **Step 4: Duration check:** `ffprobe … <slug>.mp3` → 900–1080 s (13–19 min validator tolerance).
- [ ] **Step 5: Seed + browser spot-check:** `npm run seed`; play the first minute of audio, answer 2–3 questions, confirm section 1 unlock.
- [ ] **Step 6: Commit:** `content(listening): <slug> — <Title>, 40q A2`.

### Task 13: Author the B1 batch — `practice_b1_01`, `practice_b1_02`, `practice_b1_03`

Same 6-step per-set procedure as Task 12, using matrix rows 6–8: ~2,400 speech words (calibrated), pauses 25+20 per section, expected duration 1140–1320 s (validator band 17–23 min). B1 language: natural connected speech, some idioms, occasional distractor corrections ("...actually, make that Thursday"). Commit per set: `content(listening): <slug> — <Title>, 40q B1`.

### Task 14: Author the B2 batch — `practice_b2_01`, `practice_b2_02`, `practice_b2_03`

Same procedure, matrix rows 9–11: ~3,000 speech words (calibrated), pauses 30+25 per section + one `[PAUSE:15]` mid-S3, expected duration 1380–1620 s (band 22–28 min). B2 language: academic/professional registers, denser information, plausible distractors requiring inference. Commit per set: `content(listening): <slug> — <Title>, 40q B2`.

### Task 15: Author the C1 batch — `practice_c1_01`, `practice_c1_02`, `practice_c1_03`

Same procedure, matrix rows 12–14: ~3,650 speech words (calibrated), pauses 40+30 per section + `[PAUSE:15]` mid-S3 and mid-S4, expected duration 1680–1920 s (band 26–34 min). C1 language: abstract argumentation, hedging, speaker disagreement, paraphrase-heavy questions (answer wording ≠ transcript wording for MCQs). Commit per set: `content(listening): <slug> — <Title>, 40q C1`.

### Task 16: Docs + final verification

**Files:**
- Modify: `web/README.md` (listening section)

- [ ] **Step 1: Update `web/README.md`** — rewrite the "Listening audio" / add-a-set recipe to document: front-matter `level:` (required for PRACTICE), the 4×10/1–40 shape, the two allowed section titles, `NARRATOR: Section N.` marker convention (per-section transcript unlock), pause budgets per level, the duration bands, the voice-rotation + never-Jenny-for-characters rule, and the workflow `author → npm run seed:validate-listening → generate_audio.py → npm run seed`. Note the repo-size tradeoff (48 kbps mono, ~0.36 MB/min, mp3s committed).

- [ ] **Step 2: Full verification suite** (see table below), fix anything red.

- [ ] **Step 3: Commit:** `docs(web): listening authoring guide for leveled 40-question sets`.

---

## Verification (end of Phase A, after each content batch, and at the very end)

| Command (from `web/`) | Expected |
|---|---|
| `npm test` | Green: `transcript.test.ts`, `sections.test.ts`, `check-listening.test.ts`, extended `parse-listening.test.ts`, all existing suites |
| `npm run lint && npm run build` | Clean |
| `npm run seed:validate-listening` | Final state: 16 files, `0 error(s)`; every practice line `OK … level=<L> sections=4 questions=40`; no `possible duplicate content` warnings |
| `npm run seed -- --dry-run` | 16 sets listed; practice sets `(40 questions)`; prune lines only right after Tasks 10/11 |
| `npm run seed` | 16 listening sets, 700 questions total (14×40 practice + 40 + 100 placement) |
| `ffprobe` each new mp3 | Within its level band: A2 780–1140 s, B1 1020–1380 s, B2 1320–1680 s, C1 1560–2040 s (targets: 15–18/19–22/23–27/28–32 min) |
| `du -sh public/audio/listening` | ≈ 120–140 MB total (one-time git growth ~+115 MB) |
| Browser `/listening` | 4 groups: `A2 Sơ cấp · 5 bài`, `B1 Trung cấp · 3 bài`, `B2 Trung cao cấp · 3 bài`, `C1 Cao cấp · 3 bài`; each card `40 câu · ~N phút`; no "Khác" group |
| Browser any set page | Level badge by the title; 4-pill stepper; completing Phần 1 unlocks `Lời thoại — Phần 1` only; finishing all 40 unlocks everything; placement sets opened directly still render (full-set transcript gate fallback) |
| Deploy | Unchanged: image already carries `web/content/` + `web/public/`; run `make migrate && make seed` after rebuild |

## Risks & mitigations

1. **Authoring volume dominates** (14 sets × ~1.8–3.7k words + 560 questions): mitigated by the validator gate, the rigid template, per-set commits, and level-batched tasks; batches are human-parallelizable across sessions (audio generation is per-file independent) — but within one agent session, subagents stay sequential (user rule).
2. **edge-tts flakiness/throttling** on long files: per-line 3× retry exists in `generate_audio.py`; regeneration is idempotent per file; ≤2–3 concurrent generations.
3. **Duration drift**: the 150 wpm estimator is heuristic → Task 10 calibrates it against real ffprobe output before the remaining 13 sets are authored; duration checks are WARN-only.
4. **Similarity false positives** from shared scaffolding: NARRATOR lines are stripped before shingling; threshold 0.30 tunable in one constant.
5. **Client-only progress**: refreshing mid-set loses progress — unchanged from today but now sets are 15–32 min. Documented known limitation; a persisted `ListeningAttempt` model is explicitly OUT OF SCOPE for this plan.
6. **Renamed slugs** (`practice_01`, `placement_01`) leave stale DB rows/links: ingest pruning (Task 3) removes rows; 404 on old URLs acceptable pre-launch.
7. **Repo grows ~+115 MB** of committed mp3: accepted (48 kbps mono kept for clarity; Docker build needs plain files, so no LFS). Escape hatch if it ever matters: one-line `bitrate="32k"` in `generate_audio.py` + regenerate.
8. **React strict-mode double effects** on section-complete callbacks: guarded by `reportedRef` (Task 8).
9. **Old sets' transcripts** may not split per-section (fewer markers than sections): `transcriptChunksForSections` returns null → full-set gate fallback; after Tasks 10–11 all practice sets satisfy the marker convention anyway.

## Out of scope (deliberate)

- Persisted listening progress/attempts (needs a schema + API redesign).
- Rate/speed control per level in TTS (`generate_audio.py` unchanged; level difficulty comes from language + length).
- TOEIC-style practice sets with images; the repo-root `toeic_practice_tests/` placeholders (separate corpus, untouched).
- Placement flow changes (`seed-placement.ts`, wizard) — only its hardcoded `placement_ielts`/`placement_toeic` slugs continue to exist, unaffected.
