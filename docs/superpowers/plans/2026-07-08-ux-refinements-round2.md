# UX Refinements Round 2 (Design-Matched) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Run at most ONE subagent at a time — never parallel (user rule).**

**Goal:** Implement the 8 Claude-Design refinement items (`fix_some_screen/refinements-export/REFINEMENTS_PROMPT.md` + `screens/*.png`) plus the frontmatter fix, keyboard shortcuts, display-name flow, and the port-3000 redeploy — superseding `docs/superpowers/plans/2026-07-07-ux-refinements.md`.

**Architecture:** All changes live in the existing Next.js 15 App Router app under `web/` (React 19, Tailwind v4, Prisma 6 + Postgres). Content is seeded from repo markdown into Postgres — the frontmatter fix happens at seed time plus a defensive strip at render. UI must match the mockups in `fix_some_screen/refinements-export/screens/` (view them before styling each task; `NN-light/dark.png` map to intro + items 1–8).

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind v4 tokens in `web/src/app/globals.css` (`text-h1/h2/body/caption`, `shadow-primary-glow`, `animate-shake/pop/progress-fill`, oklch indigo-violet + coral), Prisma 6, vitest (`cd web && npm test`), Docker Compose + Makefile.

**Current state (verified 2026-07-08):** `web/` working tree is clean. Already shipped: IELTS hub skill tabs with `?skill=` deep-links (`ab7b57f`), runner desktop split-feedback column (`f837b30` — this plan *replaces* that layout per design item 1). NOT done: frontmatter strip, error-correction UX/grading, shortcuts, lecture CTA, vocab-tab removal, sidebar settings removal, name flow, skill-scoped IELTS detail page, phase pill row.

## Global Constraints

- **Auto-commit per task:** the moment a task's verify step passes, `git add` that task's files and commit with the message given in the task — do not batch tasks and do not ask before committing. Work directly on `main` (repo convention).
- **Never edit curriculum content files** (`phase_*/`, `ielts_practice_tests/`, `web/content/`): frontmatter is stripped at seed/render time only (CLAUDE.md hard rule).
- UI copy is **Vietnamese**; learning content stays English. Don't translate existing content.
- Reuse existing tokens/radii/animations from `globals.css` — "Dùng CHÍNH XÁC màu/khoảng cách/bo góc trong ảnh — không tự sáng tạo" (design prompt).
- Every screen must work at mobile 375px and desktop 1280px, light + dark, hit targets ≥44px, visible focus ring.
- Tests: `cd web && npm test` (vitest, needs `web/.env.local`).
- If executing with subagents: **at most one subagent at a time, never parallel** (user rule).
- App must end up on **port 3000** via `make up`; the Cloudflare tunnel already targets `web:3000`.
- Root `git status` has pre-existing uncommitted edits to `.env.example`, `Makefile`, `docker-compose.yml` — never include them in a task commit; they are reconciled only in Task 12.

---

### Task 1: Strip YAML frontmatter from stored/rendered markdown

Lecture/IELTS/placement pages render a leaked `id: "phase_1_foundation/..."` block: seed scripts store raw files verbatim (`ingest.ts:180-183`, `seed-ielts.ts:41-74`, `seed-placement.ts:554-556`) and `MarkdownContent` renders content straight through (`MarkdownContent.tsx:86-88`).

**Files:**
- Create: `web/scripts/seed/strip-frontmatter.ts`, `web/scripts/seed/strip-frontmatter.test.ts`
- Modify: `web/scripts/seed/ingest.ts`, `web/scripts/seed/seed-ielts.ts`, `web/scripts/seed/seed-placement.ts`, `web/src/components/MarkdownContent.tsx`

**Interfaces:**
- Produces: `stripFrontmatter(md: string): string` — removes one leading `---\n...\n---\n` block if present, else returns input unchanged.

- [ ] **Step 1: Write the failing test** — `web/scripts/seed/strip-frontmatter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stripFrontmatter } from "./strip-frontmatter";

describe("stripFrontmatter", () => {
  it("removes a leading YAML frontmatter block", () => {
    const md = `---\nid: "phase_1/lesson_01/lecture"\ntype: lecture\n---\n\n# BÀI 1\n`;
    expect(stripFrontmatter(md)).toBe(`\n# BÀI 1\n`);
  });
  it("returns content without frontmatter unchanged", () => {
    expect(stripFrontmatter("# Heading\nbody")).toBe("# Heading\nbody");
  });
  it("does not touch a --- thematic break later in the document", () => {
    const md = "# Heading\n\n---\n\nbody";
    expect(stripFrontmatter(md)).toBe(md);
  });
  it("handles empty string", () => {
    expect(stripFrontmatter("")).toBe("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `cd web && npx vitest run scripts/seed/strip-frontmatter.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `web/scripts/seed/strip-frontmatter.ts`:

```ts
/** Matches one YAML frontmatter block at the very start of a file. */
export const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;

/** Removes a leading YAML frontmatter block; no-op when absent. */
export function stripFrontmatter(md: string): string {
  return md.replace(FRONT_MATTER_RE, "");
}
```

- [ ] **Step 4: Run the test → PASS**, then the whole suite: `cd web && npm test` → PASS.

- [ ] **Step 5: Use it at every seed read site** (import `stripFrontmatter` in each file):
  - `ingest.ts` (~line 180): wrap the three lesson reads, e.g. `const lectureMd = stripFrontmatter(readOptional(lectureMdPath));` — same for vocab and exercise markdown. (The `contentHash` is computed from the stripped strings, so every lesson hash changes → next seed run re-ingests all rows. Intended.)
  - `seed-ielts.ts` (~lines 41-74): wrap all four per-test file reads (reading/writing/speaking/answer key).
  - `seed-placement.ts` (~lines 554-556): wrap the three placement markdown reads.

- [ ] **Step 6: Defensive strip at render** so stale DB rows stop leaking before the re-seed — in `web/src/components/MarkdownContent.tsx`, before the `ReactMarkdown` call (~line 86):

```tsx
const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;
// inside the component:
const body = content.replace(FRONT_MATTER_RE, "");
```

and render `{body}` instead of `{content}`. (Duplicated regex on purpose: app code must not import from `scripts/`.)

- [ ] **Step 7: Verify** — `cd web && npm test` PASS; `npm run seed && npm run seed:ielts && npm run seed:placement` complete and log updates (not "skipped (unchanged)"); a lecture page and IELTS Đề 1 show no `id:`/`type:` block.

- [ ] **Step 8: Commit**

```bash
git add web/scripts/seed web/src/components/MarkdownContent.tsx
git commit -m "fix(web): strip YAML frontmatter at seed time and render time"
```

---

### Task 2: Exercise runner — one centered column, button in the card footer

Design item 1 (screens `02-light/dark.png`). This **replaces** the current desktop split-feedback layout (`f837b30`): kicker · question card · feedback · action button become ONE centered ~720px column; the Kiểm tra/Thử lại/Tiếp tục button moves **inside the card footer** (design: "Nút 'Kiểm tra' nằm trong footer thẻ, không trôi ra góc phải"); wrong-answer feedback slides in directly below the card. All four states stay: no input (disabled) → Kiểm tra → Sai (shake + 💡 keyNote + Thử lại) → Đúng (pop + Tiếp tục).

**Files:**
- Modify: `web/src/components/ExerciseRunner.tsx` (`ExerciseRunnerSession` return JSX, lines 164-254)

**Interfaces:**
- Consumes: existing `QuestionCard`, `ExplanationSlot`, reducer — unchanged.
- Produces: a `<div ref={cardRef}>` column wrapper that Task 4 attaches shortcuts to (Task 4 adds the ref; this task only reshapes JSX).

- [ ] **Step 1: Reshape the JSX.** Keep the top bar (lines 166-188) full-width. Replace everything from line 190 (kicker) through line 252 (button row) with:

```tsx
      <div className="flex w-full flex-col gap-3 lg:mx-auto lg:max-w-[720px]">
        <p className="text-caption font-semibold text-primary lg:text-center">
          {kickerFor(question.kind)}
        </p>

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
            disabled={isChecking || isCorrect}
            status={state.phase}
            onChangeInput={(value) => dispatch({ type: "SET_INPUT", value })}
            emphasizePrompt
          />

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

          {/* Card footer: the single primary action lives INSIDE the card. */}
          <div className="mt-4 flex justify-end border-t border-border/60 pt-4">
            {isCorrect ? (
              <Button className="w-full sm:w-auto" onClick={() => dispatch({ type: "CONTINUE" })}>
                Tiếp tục
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto"
                variant={isIncorrect ? "outline" : "default"}
                onClick={handleSubmit}
                disabled={isChecking || state.input.trim() === ""}
              >
                {isIncorrect ? "Thử lại" : "Kiểm tra"}
              </Button>
            )}
          </div>
        </div>

        {isIncorrect && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-destructive">Chưa đúng, thử lại.</p>
            {state.result?.keyNote && (
              <div className="rounded-xl border border-destructive/30 bg-destructive-bg p-4">
                <p className="mb-1 text-caption font-bold text-destructive">💡 Ghi nhớ</p>
                <p className="text-sm leading-relaxed">{state.result.keyNote}</p>
              </div>
            )}
            <ExplanationSlot explanation={state.result?.explanation ?? null} />
          </div>
        )}
      </div>
```

Concretely: delete the `lg:grid lg:grid-cols-2 lg:items-start lg:gap-6` wrapper (line 192) and the trailing `flex justify-end gap-3` button row (lines 237-252); the feedback block moves below the card inside the same 720px column. Compare against `screens/02-light.png` + `02-dark.png` for spacing.

- [ ] **Step 2: Verify** — `cd web && npm run dev`, open a lesson exercise at 1280px: kicker/card/feedback in one centered ~720px column; the action button sits in the card footer, never at the viewport edge; a wrong answer shows shake + the 💡 note below the card without reflowing the card; 375px still single-column with a full-width button; dark mode OK.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(web): runner single centered column with in-card action footer"
```

---

### Task 3: Error-correction — one input, wavy-underline hint, containment grading

Design item 2 (screens `03-light/dark.png`): the original sentence renders big with a **wavy destructive underline under the suspect words**, caption "Viết lại cả câu cho đúng.", label "Câu đúng", ONE input where the learner retypes the whole corrected sentence. (NOT two Lỗi/Sửa fields.)

Grading today can't accept that: stored `AnswerVariant`s for `ERROR_CORRECTION` usually contain **only the corrected word/phrase** (e.g. `doesn't like`), so a full retyped sentence fails EXACT/VARIANT and rarely clears the 0.85 FUZZY bar (`match.ts:167-205`). Fix: accept a sentence that **contains** a variant as a whole phrase.

The underline hint needs the error location. Variants are secret (never sent to the client — `SafeQuestion` in `QuestionCard.tsx:24-31` has no variants), so the span is computed **server-side** and only the character offsets ship to the client.

**Files:**
- Modify: `web/src/lib/grading/match.ts` (containment rule + export `similarity`), `web/src/lib/grading/match.test.ts`
- Create: `web/src/lib/grading/error-span.ts`, `web/src/lib/grading/error-span.test.ts`
- Modify: `web/src/components/runner/QuestionCard.tsx` (ERROR_CORRECTION branch + `errorSpan` on `SafeQuestion`)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx` (compute `errorSpan` where questions are mapped to `SafeQuestion` — grep `isOpenEnded` to find the mapping; extend the Prisma query to also select `variants: { select: { normalized: true } }`, use them server-side only, and do NOT pass variants to the client)

**Interfaces:**
- Produces (grading): `matchAnswer` accepts whole-sentence input for `kind === "ERROR_CORRECTION"` via whole-phrase variant containment, reported as the existing `matchType: "VARIANT"` (Prisma `MatchType` enum — no migration).
- Produces (hint): `stripErrorScaffold(prompt: string): string` and `findErrorSpan(prompt: string, variantNormalized: string): { start: number; end: number } | null` (char offsets into the *scaffold-stripped* prompt). `SafeQuestion` gains optional `errorSpan?: { start: number; end: number } | null` — optional so `ListeningRunner`/`PlacementWizard` compile unchanged.
- Consumes: `normalize` from `web/src/lib/grading/normalize.ts`; `escapeRegExp` already in `match.ts:106`.

- [ ] **Step 1: Failing grading tests** — append to `web/src/lib/grading/match.test.ts` (self-contained builder; `MatchQuestion` is exported at `match.ts:23`):

```ts
import { normalize } from "./normalize";

const ecQuestion = (variants: string[]): MatchQuestion => ({
  kind: "ERROR_CORRECTION",
  isOpenEnded: false,
  variants: variants.map((v) => ({ normalized: normalize(v) })),
});

describe("ERROR_CORRECTION whole-sentence answers", () => {
  const q = ecQuestion(["doesn't like"]);
  it("accepts the full corrected sentence containing the fix", () => {
    expect(matchAnswer("She doesn't like vegetables. She prefers fruit.", q).correct).toBe(true);
  });
  it("accepts the expanded contraction inside the sentence", () => {
    expect(matchAnswer("She does not like vegetables.", q).correct).toBe(true);
  });
  it("still accepts the bare corrected phrase", () => {
    expect(matchAnswer("doesn't like", q).correct).toBe(true);
  });
  it("rejects the original uncorrected sentence", () => {
    expect(matchAnswer("She don't like vegetables. She prefer fruit.", q).correct).toBe(false);
  });
  it("does not match a variant inside a longer word", () => {
    expect(matchAnswer("she prefersx", ecQuestion(["prefers"])).correct).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify the sentence cases fail** — `cd web && npx vitest run src/lib/grading/match.test.ts` → the first two tests FAIL.

- [ ] **Step 3: Implement containment in `match.ts`.** Inside `matchAnswer`, after the FUZZY block (line 196) and before the MANUAL block, reusing the `forms` array from line 182:

```ts
  // ERROR_CORRECTION: the learner retypes the WHOLE corrected sentence, but
  // seeded variants usually hold only the corrected word/phrase. Accept any
  // contraction form of the input that contains a variant as a whole phrase.
  // Reported as VARIANT (Prisma MatchType enum — no migration).
  if (question.kind === "ERROR_CORRECTION") {
    for (const form of forms) {
      for (const variantText of variantTexts) {
        if (
          variantText.length > 0 &&
          new RegExp(`(?:^| )${escapeRegExp(variantText)}(?: |$)`).test(form)
        ) {
          return { correct: true, matchType: "VARIANT" };
        }
      }
    }
  }
```

(`normalize()` collapses whitespace/punctuation, so spaces are the only separators — the `(?:^| )…(?: |$)` anchors give whole-word boundaries. Runs after FUZZY so full-sentence variants keep matching the old way; rejects still fall through as before.) Also change `function similarity` (line 161) to `export function similarity` for Step 5.

- [ ] **Step 4: Run tests → PASS**, plus the full suite `npm test` (existing ERROR_CORRECTION fuzzy tests must still pass).

- [ ] **Step 5: Failing tests for the hint helpers** — `web/src/lib/grading/error-span.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";
import { findErrorSpan, stripErrorScaffold } from "./error-span";

describe("stripErrorScaffold", () => {
  it("removes the Lỗi/Sửa scaffold line", () => {
    const p = "She don't like vegetables.\n→ Lỗi: ___ → Sửa: ___";
    expect(stripErrorScaffold(p)).toBe("She don't like vegetables.");
  });
  it("leaves plain prompts unchanged", () => {
    expect(stripErrorScaffold("She don't like vegetables.")).toBe("She don't like vegetables.");
  });
});

describe("findErrorSpan", () => {
  it("finds the suspect words closest to the corrected variant", () => {
    const prompt = "She don't like vegetables.";
    const span = findErrorSpan(prompt, normalize("doesn't like"));
    expect(span).not.toBeNull();
    expect(prompt.slice(span!.start, span!.end)).toBe("don't like");
  });
  it("returns null when nothing resembles the variant", () => {
    expect(findErrorSpan("Completely unrelated words here.", normalize("doesn't like"))).toBeNull();
  });
  it("returns null for an empty variant", () => {
    expect(findErrorSpan("She don't like vegetables.", "")).toBeNull();
  });
});
```

- [ ] **Step 6: Run to verify FAIL, then implement** `web/src/lib/grading/error-span.ts`:

```ts
import { normalize } from "./normalize";
import { similarity } from "./match";

export type ErrorSpan = { start: number; end: number };

/** Strips the trailing "Lỗi: ___ → Sửa: ___" scaffold some seeded
 * ERROR_CORRECTION prompts carry — the retype-the-sentence UI replaces it. */
export function stripErrorScaffold(prompt: string): string {
  return prompt.replace(/(?:→|->)?\s*Lỗi:\s*_{2,}\s*(?:→|->)\s*Sửa:\s*_{2,}\s*$/m, "").trim();
}

type Token = { text: string; start: number; end: number };

function tokenize(prompt: string): Token[] {
  const tokens: Token[] = [];
  for (const m of prompt.matchAll(/[A-Za-z0-9'’-]+/g)) {
    tokens.push({ text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  return tokens;
}

/**
 * Locates the words in the original (wrong) sentence that the corrected
 * variant most plausibly replaces, so the UI can wavy-underline them as a
 * hint. Sliding word-window vs the normalized variant; a window is a
 * candidate only when similar-but-not-equal (0.5 ≤ score < 1). Null when
 * nothing clears the bar — callers render no underline (safe fallback).
 */
export function findErrorSpan(prompt: string, variantNormalized: string): ErrorSpan | null {
  const variantWords = variantNormalized.split(" ").filter(Boolean);
  if (variantWords.length === 0) return null;
  const tokens = tokenize(prompt);
  let best: { span: ErrorSpan; score: number } | null = null;
  for (const size of [variantWords.length, variantWords.length - 1, variantWords.length + 1]) {
    if (size < 1) continue;
    for (let i = 0; i + size <= tokens.length; i++) {
      const window = tokens.slice(i, i + size);
      const text = normalize(window.map((t) => t.text).join(" "));
      const score = similarity(text, variantNormalized);
      if (score >= 0.5 && score < 1 && (!best || score > best.score)) {
        best = { span: { start: window[0].start, end: window[window.length - 1].end }, score };
      }
    }
  }
  return best?.span ?? null;
}
```

Run `npx vitest run src/lib/grading/error-span.test.ts` → PASS. (If the "don't like" test fails on the exact offsets, check what `normalize` does with apostrophes and adjust the tokenizer's character class to match — the span must cover exactly `don't like` in the raw prompt.)

- [ ] **Step 7: Ship the span to the client.** In `exercise/page.tsx`, at the `SafeQuestion` mapping: for `kind === "ERROR_CORRECTION"`, set

```ts
errorSpan: findErrorSpan(stripErrorScaffold(q.prompt), q.variants[0]?.normalized ?? ""),
```

(variants used server-side only). Add to `SafeQuestion` in `QuestionCard.tsx`:

```ts
  errorSpan?: { start: number; end: number } | null;
```

- [ ] **Step 8: ERROR_CORRECTION branch in `QuestionCard.tsx`** — add before the final `TextAreaAnswer` fallback (line ~255):

```tsx
if (question.kind === "ERROR_CORRECTION") {
  return (
    <ErrorCorrectionAnswer
      question={question}
      disabled={disabled}
      status={status}
      onChangeJoined={onChangeInput}
      emphasizePrompt={emphasizePrompt}
    />
  );
}
```

and implement the component in the same file (mirrors `TextAreaAnswer`'s local-state pattern, lines 174-209):

```tsx
function ErrorCorrectionAnswer({
  question,
  disabled,
  status,
  onChangeJoined,
  emphasizePrompt,
}: {
  question: SafeQuestion;
  disabled: boolean;
  status: QuestionStatus;
  onChangeJoined: (value: string) => void;
  emphasizePrompt: boolean;
}) {
  const [value, setValue] = useState("");
  const isWrong = status === "incorrect";
  const isCorrectPick = status === "correct";

  const sentence = stripErrorScaffold(question.prompt);
  const span = question.errorSpan ?? null;

  return (
    <div>
      <p className={cn("text-base font-bold leading-relaxed", emphasizePrompt && "lg:text-h2")}>
        {span ? (
          <>
            {sentence.slice(0, span.start)}
            <span className="underline decoration-destructive decoration-wavy underline-offset-4">
              {sentence.slice(span.start, span.end)}
            </span>
            {sentence.slice(span.end)}
          </>
        ) : (
          sentence
        )}
      </p>
      <p className="mt-1 text-caption text-muted-foreground">Viết lại cả câu cho đúng.</p>

      <label className="mt-4 block text-caption font-semibold text-muted-foreground">
        Câu đúng
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            onChangeJoined(e.target.value);
          }}
          placeholder="Gõ lại cả câu đã sửa..."
          className={cn(
            "mt-1.5 w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
            isWrong && "animate-shake border-destructive bg-destructive-bg text-destructive",
            isCorrectPick && "animate-pop border-success bg-success-bg text-success",
          )}
        />
      </label>
    </div>
  );
}
```

Import `stripErrorScaffold` from `@/lib/grading/error-span` at the top of `QuestionCard.tsx`. Match `screens/03-light.png`/`03-dark.png` (bold sentence, wavy underline, "Câu đúng" label, single input).

- [ ] **Step 9: Verify in browser** — open the exercise with "She don't like vegetables…": one input, wavy underline under `don't like`, no `Lỗi/Sửa` scaffold; the full corrected sentence grades **correct** (pop); the bare corrected phrase still passes; the original sentence unchanged shakes as wrong. `npm test` PASS.

- [ ] **Step 10: Commit**

```bash
git commit -am "feat(web): error-correction retype-the-sentence UI with wavy hint + containment grading"
```

---

### Task 4: Runner keyboard shortcuts (Ctrl+Enter, Ctrl+←/→, 1-4)

The runner has zero keyboard handling (verified). Spec: **Ctrl+Enter** fires the current primary action (Kiểm tra/Thử lại/Tiếp tục) for every kind, even while typing in an input/textarea; **Ctrl+←/→** hops focus across multiple answer fields (multi-blank fills); digits **1-4** pick MCQ options only when not typing in a text field.

**Files:**
- Create: `web/src/components/runner/useRunnerShortcuts.ts`, `web/src/components/runner/useRunnerShortcuts.test.ts`
- Modify: `web/src/components/ExerciseRunner.tsx` (wire hook + `ref={cardRef}` on Task 2's 720px column wrapper)
- Modify: `web/src/components/runner/QuestionCard.tsx` — add `data-answer-field` to fill-blank inputs (line ~91), the `TextAreaAnswer` textarea (line ~192), and Task 3's error-correction input; add `data-mcq-option` to MCQ option buttons (line ~136)

**Interfaces:**
- Produces: `useRunnerShortcuts({ containerRef, onPrimaryAction }): void` and pure helper `moveIndex(current: number, dir: 1 | -1, length: number): number`.
- Consumes: DOM markers `[data-answer-field]` / `[data-mcq-option]` inside `containerRef`.

- [ ] **Step 1: Failing test for the pure helper** — `useRunnerShortcuts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { moveIndex } from "./useRunnerShortcuts";

describe("moveIndex", () => {
  it("moves right and clamps at the last field", () => {
    expect(moveIndex(0, 1, 3)).toBe(1);
    expect(moveIndex(2, 1, 3)).toBe(2);
  });
  it("moves left and clamps at the first field", () => {
    expect(moveIndex(1, -1, 3)).toBe(0);
    expect(moveIndex(0, -1, 3)).toBe(0);
  });
  it("enters at the first field when nothing is focused (-1)", () => {
    expect(moveIndex(-1, 1, 3)).toBe(0);
    expect(moveIndex(-1, -1, 3)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**, then implement `useRunnerShortcuts.ts`:

```ts
"use client";

import { useEffect, type RefObject } from "react";

export function moveIndex(current: number, dir: 1 | -1, length: number): number {
  if (current === -1) return 0;
  return Math.min(Math.max(current + dir, 0), length - 1);
}

/**
 * Global runner shortcuts. Ctrl+Enter always fires the primary action (the
 * reducer/submit guards make it a no-op in invalid phases). Digit keys only
 * act when the user is NOT typing in a text field.
 */
export function useRunnerShortcuts({
  containerRef,
  onPrimaryAction,
}: {
  containerRef: RefObject<HTMLElement | null>;
  onPrimaryAction: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        onPrimaryAction();
        return;
      }

      const root = containerRef.current;
      if (!root) return;

      if (e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const fields = Array.from(root.querySelectorAll<HTMLElement>("[data-answer-field]"));
        if (fields.length === 0) return;
        e.preventDefault();
        const current = fields.indexOf(document.activeElement as HTMLElement);
        fields[moveIndex(current, e.key === "ArrowRight" ? 1 : -1, fields.length)]?.focus();
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-4]$/.test(e.key)) {
        const options = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-mcq-option]"));
        options[Number(e.key) - 1]?.click();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [containerRef, onPrimaryAction]);
}
```

- [ ] **Step 3: Run tests** — `npx vitest run src/components/runner/useRunnerShortcuts.test.ts` → PASS.

- [ ] **Step 4: Wire into `ExerciseRunnerSession`** (`ExerciseRunner.tsx`; add `useRef` to the react import):

```tsx
const cardRef = useRef<HTMLDivElement | null>(null);

useRunnerShortcuts({
  containerRef: cardRef,
  onPrimaryAction: () => {
    if (state.phase === "correct") dispatch({ type: "CONTINUE" });
    else void handleSubmit();               // guards handle checking/empty
  },
});
```

Put `ref={cardRef}` on Task 2's `lg:max-w-[720px]` column wrapper. Add the `data-answer-field` / `data-mcq-option` attributes in `QuestionCard.tsx` as listed under **Files**.

- [ ] **Step 5: Verify in browser** — multi-blank fill: Ctrl+→/← hops blanks, Ctrl+Enter checks mid-typing; error-correction input: Ctrl+Enter submits while typing; MCQ: `2` picks option b, digits type normally while a text field has focus; after a correct answer Ctrl+Enter advances.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(web): runner keyboard shortcuts (ctrl+enter, ctrl+arrows, 1-4)"
```

---

### Task 5: "Làm bài tập →" CTA at the end of each lecture

Design item 4 (screens `05-light/dark.png`): divider + encouragement line + glowing primary button, auto-width centered in the 680px reading column on desktop, full-width on mobile.

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx` (after `<MarkdownContent>` at line 47; `base` is defined at line 33)

- [ ] **Step 1: Add the CTA block** (add imports `Link` from `next/link`, `cn` from `@/lib/utils`, `buttonVariants` from `@/components/ui/button`):

```tsx
        <MarkdownContent content={lesson.lectureMd} />

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-8">
          <p className="text-caption text-muted-foreground">
            Đã đọc xong? Luyện tập ngay để mở khoá bài tiếp theo.
          </p>
          <Link
            href={`${base}/exercise`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full shadow-primary-glow transition-shadow hover:shadow-lg sm:w-auto",
            )}
          >
            Làm bài tập →
          </Link>
        </div>
```

- [ ] **Step 2: Verify** — scroll any lecture to the bottom at 375px (full-width button) and 1280px (centered auto-width, glow on hover, ring on keyboard focus); clicking navigates to `/learn/<phase>/<lesson>/exercise`.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(web): end-of-lecture CTA to the lesson exercise"
```

---

### Task 6: Lesson tabs — drop "Từ vựng", switch to a 2-tab segmented control

Design item 3 (screens `04-light/dark.png`): two tabs (Bài giảng · Bài tập) as a compact segmented control (active tab = card background + shadow), keeping back-link, phase kicker, lesson title.

**IMPORTANT — do NOT redirect the lesson vocab page** (the old plan did): the `/vocab` hub deep-links to `/learn/<phase>/<lesson>/vocab` (`vocab/page.tsx:102` in the hub) for the flashcard/quiz/matching games. Only the tab goes; the page gets its own header.

**Files:**
- Modify: `web/src/components/LessonTabs.tsx` (TAB_DEFS lines 5-11, tab bar lines 41-56)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/page.tsx` (replace the `<LessonTabs active="vocab">` at lines 60-64 with a standalone header)

- [ ] **Step 1: Shrink + restyle the tabs** in `LessonTabs.tsx`:

```tsx
type LessonTabKey = "lecture" | "exercise";

const TAB_DEFS: { key: LessonTabKey; label: string; suffix: string }[] = [
  { key: "lecture", label: "Bài giảng", suffix: "" },
  { key: "exercise", label: "Bài tập", suffix: "/exercise" },
];
```

and replace the underline bar (lines 41-56) with a segmented control:

```tsx
      <div className="mb-6 inline-flex gap-1 rounded-xl bg-muted p-1">
        {TAB_DEFS.map((tab) => (
          <Link
            key={tab.key}
            href={`${basePath}${tab.suffix}`}
            className={cn(
              "flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
              active === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
```

TypeScript now errors on `active="vocab"` in `vocab/page.tsx` — that's the safety net pointing at Step 2.

- [ ] **Step 2: Standalone header for the lesson vocab page** — in `vocab/page.tsx`, replace the `<LessonTabs …/>` usage (and its import if now unused) with:

```tsx
      <Link
        href="/vocab"
        className="mb-4 inline-block text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Quay lại Từ vựng
      </Link>
      <p className="text-caption font-semibold text-primary">{lesson.phase.title}</p>
      <h1 className="mb-6 text-h1 font-extrabold tracking-tight text-foreground">{lesson.title}</h1>
```

(Keep every game card and the progress ring untouched. Adjust the JSX to whatever variable names the file actually uses for phase/lesson titles — they're the same values previously passed to `LessonTabs`.)

- [ ] **Step 3: Verify** — `cd web && npx tsc --noEmit` clean (flags any other `active="vocab"` callers); lecture + exercise pages show the 2-tab segmented control matching `screens/04-light.png`; `/learn/<phase>/<lesson>/vocab` still renders the games with the new header; sidebar "Từ vựng" hub still deep-links into it.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(web): 2-tab segmented lesson control; vocab page gets standalone header"
```

---

### Task 7: Sidebar — remove "Cài đặt" from nav; profile card becomes the entrance

Design item 5 (screens `06-light.png`, `05-dark.png`): nav keeps 4 items; the bottom profile card shows the display name + band line and reveals a ⚙ gear + primary border on hover. **Keep** the `Cài đặt` link in the mobile `AppHeader` — mobile has no profile card.

**Files:**
- Modify: `web/src/components/AppSidebar.tsx` (NAV_LINKS line 14; profile card lines 67-85)

- [ ] **Step 1: Remove the nav entry** — delete `{ href: "/settings", label: "Cài đặt", icon: Settings }` from `NAV_LINKS` (the `Settings` icon import stays — reused below).

- [ ] **Step 2: Profile-card hover affordance** — update the card `Link` (line 68-71) to:

```tsx
        <Link
          href="/settings"
          className="group flex items-center gap-3 rounded-xl border border-transparent bg-muted p-3 transition-colors hover:border-primary hover:bg-secondary"
        >
```

and after the name/band `<span className="min-w-0">…</span>` block add:

```tsx
          <Settings className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
```

- [ ] **Step 3: Verify** — desktop sidebar shows 4 nav items; hovering the profile card shows primary border + gear; clicking opens `/settings`; mobile header still has its Cài đặt link.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(web): settings enters via sidebar profile card only on desktop"
```

---

### Task 8: Display name — onboarding step, inline settings editor, sidebar

Design item 7 (screens `08-light.png`) + name flow. `User.name` exists in `web/prisma/schema.prisma` (nullable) but is **never written**; `AppSidebar` and the settings banner already render `name ?? email`, so they fix themselves once the name is set. **No migration needed.** Settings gets an **inline pencil edit in the banner** (per mockup: `Nguyên Trần ✏️` with email as the secondary line), NOT an accordion row. Keep every existing row: Mục tiêu học · Làm lại kiểm tra đầu vào · ThemeToggleRow · LogoutButton (destructive, last).

**Files:**
- Create: `web/src/app/api/profile/name/route.ts`
- Create: `web/src/app/onboarding/name/page.tsx`
- Create: `web/src/components/SettingsNameEditor.tsx`
- Modify: `web/src/app/(auth)/login/verify/page.tsx` (line 63: onboarding redirect)
- Modify: `web/src/app/onboarding/path/page.tsx` (progress bar: now step 2 of 3)
- Modify: `web/src/app/(app)/settings/page.tsx` (banner name line → editor, lines 42-46)

**Interfaces:**
- Produces: `POST /api/profile/name` with JSON `{ name: string }` (1-50 chars after trim) → `{ ok: true }` | 400/401. Consumed by the onboarding page and the settings editor.
- Produces: `SettingsNameEditor({ initialName, email }: { initialName: string | null; email: string })` client component.

- [ ] **Step 1: API route** — `web/src/app/api/profile/name/route.ts`, modeled on `web/src/app/api/onboarding/path/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

const nameSchema = z.object({ name: z.string().trim().min(1).max(50) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = nameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

(Before writing, open `api/onboarding/path/route.ts` — if it doesn't use `zod`, mirror its validation style instead so the API folder stays consistent.)

- [ ] **Step 2: Onboarding name page** — `web/src/app/onboarding/name/page.tsx`, cloned from `onboarding/path/page.tsx`'s shell (progress bar first-third filled):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function OnboardingNamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên của bạn.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      router.push("/onboarding/path");
    } catch {
      setError("Không thể lưu tên. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8 lg:max-w-3xl">
      <div className="mb-8 h-1.5 w-full rounded-full bg-muted">
        <div className="h-full w-1/3 rounded-full bg-primary" />
      </div>

      <h1 className="text-h1 font-extrabold">Bạn tên là gì?</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Tên của bạn sẽ hiển thị trong ứng dụng thay cho địa chỉ email.
      </p>

      <input
        type="text"
        value={name}
        maxLength={50}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Tên hiển thị của bạn"
        className="mt-6 w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-8 flex flex-col gap-2">
        <Button type="button" className="w-full" disabled={isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? "Đang lưu..." : "Tiếp tục"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/onboarding/path")}>
          Bỏ qua
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Route new users through it** — `login/verify/page.tsx:63`:

```tsx
      router.push(data.needsOnboarding ? "/onboarding/name" : "/dashboard");
```

Then open `onboarding/path/page.tsx` and bump its progress bar to two-thirds (it's now step 2 of 3 — if the fill is `w-1/2`, make it `w-2/3`; adapt to what's actually there).

- [ ] **Step 4: Inline banner editor** — `web/src/components/SettingsNameEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline display-name editor inside the settings banner (design item 7):
 * view mode shows the name + a ✏️ button; edit mode swaps to an input with
 * a live character counter, Lưu/Huỷ, "✓ Đã lưu" on success, and an error
 * when the name is empty. Styled for the primary (dark) banner background.
 */
export function SettingsNameEditor({
  initialName,
  email,
}: {
  initialName: string | null;
  email: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setPhase("error");
      return;
    }
    setPhase("saving");
    try {
      const res = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      setPhase("saved");
      setEditing(false);
      router.refresh();
    } catch {
      setPhase("error");
    }
  }

  if (!editing) {
    return (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {initialName ?? email}
          <button
            type="button"
            aria-label="Sửa tên hiển thị"
            onClick={() => {
              setName(initialName ?? "");
              setPhase("idle");
              setEditing(true);
            }}
            className="rounded p-0.5 opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            ✏️
          </button>
          {phase === "saved" && <span className="text-xs font-normal">✓ Đã lưu</span>}
        </p>
        {initialName ? <p className="truncate text-xs text-primary-foreground/80">{email}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={50}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full max-w-56 rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/50 focus-visible:ring-2 focus-visible:ring-white/50"
        />
        <button type="button" onClick={save} disabled={phase === "saving"} className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30">
          {phase === "saving" ? "..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-primary-foreground/80 hover:text-primary-foreground">
          Huỷ
        </button>
      </div>
      <p className="mt-1 text-xs text-primary-foreground/70">
        {phase === "error" ? "Tên không được để trống." : `${name.trim().length}/50 ký tự`}
      </p>
    </div>
  );
}
```

Then in `settings/page.tsx`, replace the name/email lines inside the banner (lines 42-46 — the `<p className="truncate text-sm font-semibold">{displayName}</p>` and conditional email line) with `<SettingsNameEditor initialName={user.name} email={user.email} />`, keeping the band line (lines 47-50) below it. All other rows and the logout button stay untouched.

- [ ] **Step 5: Verify end-to-end** — new-email signup (OTP echoes to logs in dev): verify → **name** → path (progress ⅔) → placement; skipping works; in Settings the ✏️ opens the inline editor with counter, empty name shows "Tên không được để trống.", saving shows "✓ Đã lưu" and the banner + sidebar card show the name with email demoted; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(web): display name — onboarding step, inline settings editor, profile API"
```

---

### Task 9: IELTS — skill-scoped test detail page (no inner tabs, no "other skills" line)

Design item 6 (screens `07-light.png`, `01-item.png`): the detail page belongs to ONE skill — `Đề 05` + skill badge + meta line, back-link returns to the hub on the right tab. **The design explicitly drops the "kỹ năng khác" links** ("Đã bỏ dòng 'kỹ năng khác' ở góc phải"). The answer-key accordion shows only that skill's section. The hub already deep-links `?skill=` (`IeltsHub.tsx:70`) but resets to Reading on back-navigation — it must accept an initial skill.

**Files:**
- Create: `web/src/lib/ielts-answer-key.ts`, `web/src/lib/ielts-answer-key.test.ts`
- Modify: `web/src/app/(app)/ielts/page.tsx` (pass `initialSkill` from `searchParams`; currently renders `<IeltsHub tests={tests} />` at line 28)
- Modify: `web/src/components/IeltsHub.tsx` (accept `initialSkill`, update subtitle copy at lines 36-39)
- Modify: `web/src/app/(app)/ielts/[n]/page.tsx` (rewrite: single-skill view, drop `Tabs`)

**Interfaces:**
- Produces: `sliceAnswerKeyBySkill(md: string, skill: IeltsSkill): string` and `type IeltsSkill = "reading" | "writing" | "speaking"` — returns the skill's section of an `answer_key.md`, or the full md when no matching heading exists (headings vary across the 30 tests: `ĐÁP ÁN`, `ANSWER KEY`, EN/VI mixes — the fallback is the safety net).
- Consumes: existing `AnswerKeyAccordion({ answerKeyMd })` and `TabBody` helper (`ielts/[n]/page.tsx:10-15`) — unchanged.

- [ ] **Step 1: Failing tests for the slicer** — `web/src/lib/ielts-answer-key.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sliceAnswerKeyBySkill } from "./ielts-answer-key";

const KEY = `# ANSWER KEY — TEST 01

## READING

1. B
2. C

## WRITING

Task 1 model answer...

## SPEAKING

Part 1 sample...
`;

describe("sliceAnswerKeyBySkill", () => {
  it("returns only the READING section", () => {
    const out = sliceAnswerKeyBySkill(KEY, "reading");
    expect(out).toContain("1. B");
    expect(out).not.toContain("model answer");
  });
  it("returns only the SPEAKING section (last section, runs to EOF)", () => {
    const out = sliceAnswerKeyBySkill(KEY, "speaking");
    expect(out).toContain("Part 1 sample");
    expect(out).not.toContain("1. B");
  });
  it("falls back to the full key when no skill heading exists", () => {
    const md = "# Key\n1. A\n2. B\n";
    expect(sliceAnswerKeyBySkill(md, "writing")).toBe(md);
  });
});
```

- [ ] **Step 2: Run to verify FAIL, then implement** `web/src/lib/ielts-answer-key.ts`:

```ts
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
```

Run tests → PASS.

- [ ] **Step 3: Hub keeps its tab across navigation.** `ielts/page.tsx`:

```tsx
export default async function IeltsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  // ...existing session + tests fetch unchanged...
  const { skill } = await searchParams;
  const initialSkill = skill === "writing" || skill === "speaking" ? skill : "reading";
  return /* existing wrapper */ <IeltsHub tests={tests} initialSkill={initialSkill} />;
}
```

`IeltsHub.tsx`: `export function IeltsHub({ tests, initialSkill = "reading" }: { tests: { number: number; isComplete: boolean }[]; initialSkill?: IeltsSkill })`, `useState<IeltsSkill>(initialSkill)` (line 25), import `IeltsSkill` from `@/lib/ielts-answer-key`, and update the subtitle (lines 36-39) to `Chọn kỹ năng, sau đó chọn đề để luyện riêng kỹ năng đó.`

- [ ] **Step 4: Rewrite the detail page** `ielts/[n]/page.tsx` — drop the `Tabs` import/JSX entirely; keep `TabBody`:

```tsx
const SKILL_META = {
  reading: { label: "Reading", meta: "40 câu · 60 phút", empty: "Đề này chưa có phần Reading." },
  writing: { label: "Writing", meta: "2 bài · 60 phút", empty: "Đề này chưa có phần Writing." },
  speaking: { label: "Speaking", meta: "3 phần · 11-14 phút", empty: "Đề này chưa có phần Speaking." },
} as const;

// after loading `test`:
const { skill } = await searchParams;
const activeSkill: IeltsSkill = skill === "writing" || skill === "speaking" ? skill : "reading";
const content = { reading: test.readingMd, writing: test.writingMd, speaking: test.speakingMd }[activeSkill];

return (
  <div className="mx-auto max-w-3xl px-4 py-8">
    <Link
      href={`/ielts?skill=${activeSkill}`}
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
    >
      ← Quay lại đề {SKILL_META[activeSkill].label}
    </Link>

    <div className="mb-1 flex items-center gap-3">
      <h1 className="text-h1 font-extrabold">Đề {String(test.number).padStart(2, "0")}</h1>
      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
        {SKILL_META[activeSkill].label}
      </span>
      {!test.isComplete && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Chưa đủ nội dung
        </span>
      )}
    </div>
    <p className="mb-6 text-caption text-muted-foreground">{SKILL_META[activeSkill].meta}</p>

    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <TabBody content={content} emptyLabel={SKILL_META[activeSkill].empty} />
    </div>

    <AnswerKeyAccordion answerKeyMd={sliceAnswerKeyBySkill(test.answerKeyMd, activeSkill)} />
  </div>
);
```

**No "kỹ năng khác" links anywhere** — switching skills happens via the hub. Match `screens/07-light.png` for the header/badge treatment. Check `AnswerKeyAccordion.tsx`: if its summary copy doesn't already warn, set it to `Đáp án & giải thích — chỉ mở sau khi tự làm`.

- [ ] **Step 5: Verify** — hub: pick Writing → Đề 05 → page shows only Writing (`Đề 05` + Writing badge, `2 bài · 60 phút`); back-link returns with Writing still active; answer-key accordion shows the Writing section (or the full key on tests whose headings don't split — spot-check `test_01` via a quick `npx tsx` one-liner); no frontmatter leak; `npm test` PASS.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(web): skill-scoped IELTS detail page + skill-preserving hub"
```

---

### Task 10: IELTS Reading — passage left, questions right on desktop

Design item 6, layout half (screens `07-light.png` bottom card): desktop shows the academic passage on the left and its question groups on the right; mobile stacks passage → questions. Real reading files have a stable H2 structure to split on (verified in `ielts_practice_tests/test_05/reading.md`): `## READING PASSAGE 1` … `## QUESTIONS 1–13` … `## READING PASSAGE 2` … The content itself is the real test markdown from the DB — never rewrite or abridge it ("Không rút gọn hay bịa nội dung minh hoạ").

**Files:**
- Create: `web/src/lib/ielts-reading.ts`, `web/src/lib/ielts-reading.test.ts`
- Modify: `web/src/app/(app)/ielts/[n]/page.tsx` (reading branch only, on top of Task 9's rewrite)

**Interfaces:**
- Produces: `splitReadingSections(md: string): { intro: string; pairs: { passageMd: string; questionsMd: string }[] } | null` — pairs each `READING PASSAGE` H2 section with the following `QUESTIONS` H2 section; `null` when the md doesn't follow that structure (→ caller falls back to the Task 9 single-column card).
- Consumes: `MarkdownContent` (already imported in the page).

- [ ] **Step 1: Failing tests** — `web/src/lib/ielts-reading.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitReadingSections } from "./ielts-reading";

const MD = `# IELTS Academic Reading — Test 05

Rubric intro line.

## READING PASSAGE 1

### Beyond the Stars

Paragraph A text.

## QUESTIONS 1–13

### Questions 1–5

Do the following statements agree...

## READING PASSAGE 2

Passage two body.

## QUESTIONS 14–26

More questions.
`;

describe("splitReadingSections", () => {
  it("pairs each passage with its questions", () => {
    const out = splitReadingSections(MD);
    expect(out).not.toBeNull();
    expect(out!.pairs).toHaveLength(2);
    expect(out!.intro).toContain("Rubric intro line.");
    expect(out!.pairs[0].passageMd).toContain("Paragraph A text.");
    expect(out!.pairs[0].questionsMd).toContain("Questions 1–5");
    expect(out!.pairs[1].questionsMd).toContain("More questions.");
    expect(out!.pairs[0].passageMd).not.toContain("More questions.");
  });
  it("returns null for markdown without the passage/questions structure", () => {
    expect(splitReadingSections("# Just a title\n\nSome text.")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(splitReadingSections("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL, then implement** `web/src/lib/ielts-reading.ts`:

```ts
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
```

Run `npx vitest run src/lib/ielts-reading.test.ts` → PASS, then `npm test` → PASS.

- [ ] **Step 3: Two-column reading branch in the detail page.** In `ielts/[n]/page.tsx`, replace the single content card from Task 9 with:

```tsx
    {activeSkill === "reading" && readingSections ? (
      <div className="mb-6 flex flex-col gap-6">
        {readingSections.intro && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <MarkdownContent content={readingSections.intro} />
          </div>
        )}
        {readingSections.pairs.map((pair, i) => (
          <div key={i} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="rounded-2xl border border-border bg-card p-5">
              <MarkdownContent content={pair.passageMd} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <MarkdownContent content={pair.questionsMd} />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
        <TabBody content={content} emptyLabel={SKILL_META[activeSkill].empty} />
      </div>
    )}
```

with, above the return: `const readingSections = activeSkill === "reading" ? splitReadingSections(test.readingMd) : null;` — and widen the page container for reading: change the wrapper to `className={cn("mx-auto px-4 py-8", activeSkill === "reading" && readingSections ? "max-w-6xl" : "max-w-3xl")}` (import `cn`).

- [ ] **Step 4: Verify** — Đề 05 Reading at 1280px: three passage/questions column pairs (Passage 1+Q1–13, 2+Q14–26, 3+Q27–40), rubric intro on top, real test wording untouched; 375px stacks passage→questions per pair; Writing/Speaking still single-column; a structurally odd test falls back to single-column rather than breaking; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): IELTS reading passage/questions two-column desktop layout"
```

---

### Task 11: Phase row — scrollable pills + "Xem tất cả N bài"

Design item 8 (screens `09-light.png`): replace the 3-4 pill sliding window (`LessonMap.tsx:89-92`) with a horizontally scrolling row of ALL lesson pills, auto-centered on the current lesson, right-edge fade hinting more content, plus a "Xem tất cả N bài ▾" toggle that expands to a wrapped pill grid. States stay: xong ✓ / hiện tại ▶ (primary, prominent) / khoá 🔒. The dashboard right rail ("Việc hôm nay" / "Tuần này") is untouched. Locked pills stay **non-clickable** (existing `LessonNode` behavior — the lecture route guard would bounce them to /dashboard anyway); "mọi bài đều thấy" is satisfied by scrolling/expanding.

**Files:**
- Create: `web/src/components/PhasePillRow.tsx`
- Modify: `web/src/components/LessonMap.tsx` (active-phase branch, lines 89-126)

**Interfaces:**
- Produces: `PhasePillRow({ lessons, total }: { lessons: PillLesson[]; total: number })` with `type PillLesson = { id: string; orderIndex: number; title: string; state: LessonState; href: string }` (serializable — `LessonMap` stays a server component, so no Maps cross the boundary).
- Consumes: `LessonNode` from `web/src/components/lesson-node.tsx` (unchanged; `clickable:false` for LOCKED already built in).

- [ ] **Step 1: Create the client component** — `web/src/components/PhasePillRow.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import type { LessonState } from "@/lib/progress";
import { LessonNode } from "@/components/lesson-node";

export type PillLesson = {
  id: string;
  orderIndex: number;
  title: string;
  state: LessonState;
  href: string;
};

/**
 * Active-phase lesson pills (design item 8): a horizontally scrolling row of
 * ALL lessons auto-centered on the current one, with a right-edge fade mask,
 * plus a toggle that expands to a wrapped grid for the full-phase overview.
 */
export function PhasePillRow({ lessons, total }: { lessons: PillLesson[]; total: number }) {
  const [showAll, setShowAll] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showAll) return;
    const scroller = scrollerRef.current;
    const current = currentRef.current;
    if (!scroller || !current) return;
    scroller.scrollLeft = current.offsetLeft - scroller.clientWidth / 2 + current.clientWidth / 2;
  }, [showAll]);

  const pills = lessons.map((lesson) => (
    <div
      key={lesson.id}
      ref={lesson.state === "UNLOCKED" ? currentRef : undefined}
      className="shrink-0"
    >
      <LessonNode
        state={lesson.state}
        label={`Bài ${lesson.orderIndex}`}
        title={lesson.title}
        href={lesson.href}
      />
    </div>
  ));

  return (
    <div>
      {showAll ? (
        <div className="flex flex-wrap gap-2">{pills}</div>
      ) : (
        <div
          ref={scrollerRef}
          className="relative flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)]"
        >
          {pills}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="mt-3 min-h-11 text-sm font-semibold text-primary hover:underline"
      >
        {showAll ? "Thu gọn ▴" : `Xem tất cả ${total} bài ▾`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `LessonMap.tsx`** — delete the windowing block (lines 89-92) and replace the `flex flex-wrap gap-2` pill container (lines 116-126) with:

```tsx
            <PhasePillRow
              total={total}
              lessons={phase.lessons.map((lesson) => ({
                id: lesson.id,
                orderIndex: lesson.orderIndex,
                title: lesson.title,
                state: states.get(lesson.id) ?? "LOCKED",
                href: `/learn/${phase.slug}/${lesson.slug}`,
              }))}
            />
```

Import `PhasePillRow` (drop the now-unused `LessonNode` import from `LessonMap.tsx` if nothing else uses it).

- [ ] **Step 3: Verify** — dashboard at 1280px & 375px: the active phase shows all N pills in one scroll row, auto-centered on ▶ (mid-phase progress shows it centered, not at the left edge); right edge fades; scrollbar hidden; "Xem tất cả N bài ▾" expands to a wrap grid and "Thu gọn ▴" collapses back; ✓/▶/🔒 states render; locked pills don't navigate; right rail unchanged; compare against `screens/09-light.png`.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(web): phase row shows all lessons — scrollable pills + expand toggle"
```

---

### Task 12: Redeploy on port 3000 (web + db + cloudflared together)

`docker-compose.yml` already publishes `${WEB_PORT:-3000}:3000` and the Cloudflare tunnel targets `web:3000`, so no compose/Makefile change is expected — this task verifies config and performs the cutover. **Do the cutover only with the user present** (it restarts the public site). The pre-existing uncommitted edits to `.env.example`, `Makefile`, `docker-compose.yml` are reviewed here, nowhere else.

- [ ] **Step 1: Confirm port config** — `grep -E '^(WEB_PORT|POSTGRES_PORT)' .env` → expect `WEB_PORT=3000` (add/fix if missing; `.env` is not committed). Review `git diff Makefile docker-compose.yml .env.example` and reconcile with the user before committing anything here.
- [ ] **Step 2: Cutover** — `make down` then `make up` (rebuilds the `web` image with all tasks above; starts db → web → cloudflared).
- [ ] **Step 3: Re-seed with frontmatter stripping** — run the repo's seed flow against the running stack (Makefile `seed-all` / `bootstrap` path); confirm logs show lessons **updating**, not "skipped (unchanged)".
- [ ] **Step 4: Verify** — `curl -sI http://localhost:3000` → 200/307; the public tunnel URL serves the new UI; `docker compose ps` shows db/web/cloudflared up.
- [ ] **Step 5: Commit** any intentional config reconciliation from Step 1 as `chore: reconcile deploy config for port-3000 cutover` — or nothing if no file changed.

---

## Verification (end-to-end, after all tasks)

Run `make up`, then walk the app at 1280px and 375px, light + dark:

1. **Frontmatter gone:** lecture Bài 1, IELTS Đề 1 (all skills), placement content — no `id:`/`type:` block.
2. **Runner:** kicker/card/feedback in one centered ~720px column; action button in the card footer; four states (disabled → Kiểm tra → shake+💡+Thử lại → pop+Tiếp tục).
3. **Error-correction:** wavy underline under the suspect words, "Câu đúng" single input; full corrected sentence → correct; bare corrected phrase → correct; original sentence → wrong.
4. **Shortcuts:** Ctrl+Enter checks/retries/continues everywhere (incl. while typing); Ctrl+←/→ hops blanks; 1-4 picks MCQ options.
5. **Lecture:** 2-tab segmented control; CTA at the end navigates to the exercise; lesson vocab page still reachable from the /vocab hub with its own header.
6. **Sidebar:** 4 nav items; profile card hover shows ⚙ + primary border; card shows display name + band.
7. **Name flow:** fresh signup verify → name → goal (⅔ bar) → placement; inline banner edit with counter/✓ Đã lưu/empty error; sidebar updates.
8. **IELTS:** hub keeps its tab after back-navigation; detail page is one skill (badge, no "kỹ năng khác" links); Reading is passage-left/questions-right on desktop with real test wording; answer key sliced per skill behind the warning accordion.
9. **Phase row:** all pills scrollable + auto-centered + fade; "Xem tất cả N bài" grid toggle; rail unchanged.
10. **Deploy:** `http://localhost:3000` + tunnel URL serve the new build; `cd web && npm test` and `npm run lint` pass; every task landed as its own commit on `main`.
