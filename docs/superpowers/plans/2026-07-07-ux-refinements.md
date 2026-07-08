# UX Refinements Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the frontmatter leak, rebalance/fix the exercise runner (layout, error-correction grading, keyboard shortcuts), simplify lesson tabs and sidebar nav, add a display-name flow, make IELTS test pages skill-scoped, and redeploy on port 3000.

**Architecture:** All changes live in the existing Next.js 15 App Router app under `web/` (React 19, Tailwind v4, Prisma + Postgres). Content is seeded from repo markdown into Postgres — the frontmatter fix happens at seed time plus a defensive strip at render. UI work follows the companion design prompt (`docs/superpowers/plans/2026-07-07-ux-refinements-design-prompt.md`); if Claude Design mockups exist by execution time, match them, otherwise implement the written specs below.

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind v4 tokens in `web/src/app/globals.css`, Prisma 6, vitest (`cd web && npm test`), Docker Compose + Makefile for deploy.

## Global Constraints

- **Never edit curriculum content files** (`phase_*/`, `ielts_practice_tests/`, `web/content/`): frontmatter is stripped at seed/render time only (CLAUDE.md hard rule).
- UI copy is **Vietnamese**; learning content stays English. Don't translate existing content.
- Work directly on `main` (repo convention). Commit per task.
- Tests run with `cd web && npm test` (vitest, needs `web/.env.local`).
- If executing with subagents: **at most one subagent at a time, never parallel** (user rule).
- The app must end up served on **port 3000** via `make up` (web + db + cloudflared together); the Cloudflare tunnel already targets `web:3000`.
- `git status` shows pre-existing uncommitted edits to `.env.example`, `Makefile`, `docker-compose.yml` — review `git diff` on those before any commit that touches them; do not blindly include them.

---

### Task 1: Strip YAML frontmatter from stored/rendered markdown

Lecture pages and IELTS pages render a leaked `id: "phase_1_foundation/..."` block because seed scripts store raw files verbatim and `MarkdownContent` has no frontmatter handling.

**Files:**
- Create: `web/scripts/seed/strip-frontmatter.ts`
- Create: `web/scripts/seed/strip-frontmatter.test.ts`
- Modify: `web/scripts/seed/ingest.ts` (lines ~180-182), `web/scripts/seed/seed-ielts.ts` (lines ~71-74), `web/scripts/seed/seed-placement.ts` (wherever it reads md files — same wrap)
- Modify: `web/src/components/MarkdownContent.tsx` (line ~83)

**Interfaces:**
- Produces: `stripFrontmatter(md: string): string` — removes one leading `---\n...\n---\n` block if present, else returns input unchanged. Used by Tasks 9/10 indirectly (clean content after re-seed).

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

- [ ] **Step 3: Implement** — `web/scripts/seed/strip-frontmatter.ts` (same regex `parse-listening.ts:48` already uses):

```ts
/** Matches one YAML frontmatter block at the very start of a file. */
export const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;

/** Removes a leading YAML frontmatter block; no-op when absent. */
export function stripFrontmatter(md: string): string {
  return md.replace(FRONT_MATTER_RE, "");
}
```

- [ ] **Step 4: Run test to verify it passes**, then run the whole suite: `cd web && npm test` → PASS.

- [ ] **Step 5: Use it at every seed read site.**
  - `ingest.ts` (~line 180): `const lectureMd = stripFrontmatter(readOptional(lectureMdPath));` and same wrap for `vocabMd`, `exerciseMd`. (The `contentHash` is computed from the stripped strings, so every lesson's hash changes → next seed run updates all rows. That is the intended re-ingest.)
  - `seed-ielts.ts` (~lines 71-74): wrap all four `readFileOrEmpty(...)` calls in `stripFrontmatter(...)`.
  - `seed-placement.ts`: read the file first; wrap each markdown read the same way.
  - Import `stripFrontmatter` in each.

- [ ] **Step 6: Defensive strip at render** so stale DB rows stop leaking before the re-seed. In `web/src/components/MarkdownContent.tsx`:

```tsx
const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;

export function MarkdownContent({ content }: { content: string }) {
  const body = content.replace(FRONT_MATTER_RE, "");
  return (
    <div className="text-body leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
```

(Duplicated regex on purpose: `MarkdownContent` is app code and must not import from `scripts/`.)

- [ ] **Step 7: Verify locally** — `cd web && npm test` PASS; then against the dev DB: `npm run seed && npm run seed:ielts && npm run seed:placement` complete without errors and log updates (not "skipped (unchanged)") for lessons.

- [ ] **Step 8: Commit** — `git add web/scripts/seed web/src/components/MarkdownContent.tsx && git commit -m "fix(web): strip YAML frontmatter at seed time and render time"`.

---

### Task 2: Exercise runner — centered single-column layout

Implements design item 1. The card currently sits left in a `lg:grid-cols-2` while the button floats far right at the viewport edge (`ExerciseRunner.tsx:192-252`).

**Files:**
- Modify: `web/src/components/ExerciseRunner.tsx` (the `ExerciseRunnerSession` return JSX, lines ~164-253)

**Interfaces:**
- Consumes: existing `QuestionCard`, `ExplanationSlot`, reducer — unchanged.
- Produces: the card container `<div ref={cardRef}>` that Task 4 attaches shortcuts to (Task 4 adds the ref; this task only reshapes JSX).

- [ ] **Step 1: Reshape the JSX.** Keep the top bar (✕ / progress / "Câu X/47") full-width; wrap everything below it in one centered column and stack feedback + button inside it:

```tsx
return (
  <div className="flex flex-col gap-4">
    {/* top bar: UNCHANGED (lines 166-188) */}

    <div className="flex w-full flex-col gap-3 lg:mx-auto lg:max-w-[720px]">
      <p className="text-caption font-semibold text-primary lg:text-center">
        {kickerFor(question.kind)}
      </p>

      <div className={cn(/* card classes UNCHANGED */)}>
        <QuestionCard ... />
        {/* isCorrect block UNCHANGED */}
      </div>

      {isIncorrect && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-destructive">Chưa đúng, thử lại.</p>
          {/* 💡 Ghi nhớ + ExplanationSlot UNCHANGED, now below the card */}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {/* Tiếp tục / Kiểm tra / Thử lại buttons UNCHANGED */}
      </div>
    </div>
  </div>
);
```

Concretely: delete the `lg:grid lg:grid-cols-2 lg:items-start lg:gap-6` wrapper, move the `isIncorrect` feedback block after the card, and move the button row inside the new `max-w-[720px]` column. If Claude Design mockups exist, match their spacing instead of the defaults above.

- [ ] **Step 2: Verify** — `cd web && npm run dev`, open a lesson exercise at 1280px: kicker, card, feedback, and button share one centered ~720px column; button no longer at the viewport edge; wrong answer shows the note under the card without reflowing the card; 375px unchanged (single column). Take before/after screenshots.

- [ ] **Step 3: Commit** — `git commit -am "feat(web): exercise runner centered single-column layout"`.

---

### Task 3: Error-correction questions — retype the whole corrected sentence

Implements design item 2 (**mockup already made by the product owner in Claude Design — match it**). Agreed behavior: **one single textarea**; the learner retypes the entire sentence with the error fixed, then submits. `ERROR_CORRECTION` already falls through to the single `TextAreaAnswer` (`QuestionCard.tsx:255-257`), so the UI change is prompt/copy polish. The real fix is grading: stored `AnswerVariant`s for this kind usually contain **only the corrected word/phrase** (see `parse-exercise.ts:599-651`), so a full retyped sentence never matches EXACT/VARIANT and rarely reaches the 0.85 FUZZY bar — grading must accept a sentence that **contains** a variant.

**Files:**
- Modify: `web/src/lib/grading/match.ts`, `web/src/lib/grading/match.test.ts`
- Modify: `web/src/components/runner/QuestionCard.tsx`

**Interfaces:**
- Consumes: existing `onChangeInput(value: string)` → reducer `input` → POST `/api/attempts/[id]/answers` `answerText`. No API/schema change.
- Produces: `matchAnswer` accepts whole-sentence input for `kind === "ERROR_CORRECTION"` via whole-word variant containment, reported as the existing `matchType: "VARIANT"` (`MatchType` is a Prisma enum at `schema.prisma:31` — reusing `VARIANT` avoids a migration).

- [ ] **Step 1: Write failing grading tests** in `web/src/lib/grading/match.test.ts` (follow the file's existing helper style for building a `MatchQuestion`):

```ts
describe("ERROR_CORRECTION whole-sentence answers", () => {
  const q = question({ kind: "ERROR_CORRECTION", variants: ["doesn't like"] });
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
});
```

- [ ] **Step 2: Run to verify the sentence cases fail** — `cd web && npx vitest run src/lib/grading/match.test.ts` → the first two tests FAIL (no exact/variant/fuzzy match for a long sentence vs a short variant).

- [ ] **Step 3: Implement containment in `match.ts`.** Inside `matchAnswer`, after the FUZZY block (~line 196) and before the MANUAL block, using the `forms` array already computed by the VARIANT step (line ~182) and the file's existing `escapeRegExp` helper:

```ts
  // ERROR_CORRECTION: the learner retypes the WHOLE corrected sentence, but
  // seeded variants usually hold only the corrected word/phrase. Accept any
  // contraction form of the input that contains a variant as a whole
  // phrase. Reported as VARIANT (Prisma MatchType enum — no migration).
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

(Whole-word boundaries via the space/anchor pattern matter: variant `"prefers"` must not match inside `"prefersx"`; `normalize()` already collapses whitespace/punctuation so spaces are the only separators. This runs after FUZZY so full-sentence variants keep matching the old way first, and rejects still fall through to MANUAL/incorrect as before.)

- [ ] **Step 4: Run tests to verify they pass**, plus full suite `npm test` → PASS (existing ERROR_CORRECTION fuzzy tests must still pass).

- [ ] **Step 5: UI copy polish** in `QuestionCard.tsx` — add an explicit `ERROR_CORRECTION` branch before the generic fallback (line ~255) that strips the now-misleading scaffold line and sets instructional copy, per the Claude Design mockup:

```tsx
if (question.kind === "ERROR_CORRECTION") {
  const displayPrompt = question.prompt
    .replace(/(?:→|->)?\s*Lỗi:\s*_{2,}\s*(?:→|->)\s*Sửa:\s*_{2,}\s*$/m, "")
    .trim();
  return (
    <TextAreaAnswer
      prompt={displayPrompt}
      helper="Gõ lại cả câu hoàn chỉnh sau khi sửa lỗi."
      placeholder="Gõ lại cả câu đã sửa..."
      disabled={disabled}
      status={status}
      onChangeJoined={onChangeInput}
    />
  );
}
```

Extend `TextAreaAnswer` with optional `placeholder` (default: the current `"Nhập câu trả lời của bạn..."`) and optional `helper` (a `text-caption text-muted-foreground` line rendered under the textarea when present) — existing call sites stay unchanged.

- [ ] **Step 6: Verify in browser** — open the exercise from `bai_tap.png` ("She don't like vegetables…"): single textarea with the new placeholder/helper, no `Lỗi: ___ → Sửa: ___` scaffold; typing the full corrected sentence (`She doesn't like vegetables. She prefers fruit.`) grades **correct**; retyping the original sentence unchanged grades wrong.

- [ ] **Step 7: Commit** — `git commit -am "feat(web): error-correction accepts retyped corrected sentence"`.

---

### Task 4: Runner keyboard shortcuts (Ctrl+Enter, Ctrl+←/→, 1-4)

The runner has zero keyboard handling today. Spec: **Ctrl+Enter** triggers the current primary action (Kiểm tra / Thử lại / Tiếp tục) for **every** question kind, even while focus is inside an input/textarea; **Ctrl+←/→** moves focus across multiple answer fields (multi-blank fill questions); digits **1-4** pick MCQ options a-d only when not typing in a text field.

**Files:**
- Create: `web/src/components/runner/useRunnerShortcuts.ts`
- Create: `web/src/components/runner/useRunnerShortcuts.test.ts`
- Modify: `web/src/components/ExerciseRunner.tsx` (wire the hook in `ExerciseRunnerSession`)
- Modify: `web/src/components/runner/QuestionCard.tsx` (add `data-answer-field` to fill-blank inputs at line ~91 and to the `TextAreaAnswer` textarea at line ~192 — that textarea also serves error-correction after Task 3; add `data-mcq-option` to option buttons at line ~136)

**Interfaces:**
- Produces: `useRunnerShortcuts({ containerRef, onPrimaryAction }): void` and pure helper `moveIndex(current: number, dir: 1 | -1, length: number): number`.
- Consumes: DOM markers `[data-answer-field]` and `[data-mcq-option]` inside `containerRef`.

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

- [ ] **Step 4: Wire into `ExerciseRunnerSession`** (`ExerciseRunner.tsx`):

```tsx
const cardRef = useRef<HTMLDivElement | null>(null);          // + import useRef

useRunnerShortcuts({
  containerRef: cardRef,
  onPrimaryAction: () => {
    if (state.phase === "correct") dispatch({ type: "CONTINUE" });
    else void handleSubmit();                                  // guards handle checking/empty
  },
});
```

and put `ref={cardRef}` on the question-card wrapper `<div>` from Task 2. Add the `data-answer-field` / `data-mcq-option` attributes in `QuestionCard.tsx` as listed under **Files**.

- [ ] **Step 5: Verify in browser** (all four kinds):
  - Multi-blank fill question: Ctrl+→ / Ctrl+← hops between blanks; Ctrl+Enter checks while the caret is inside a blank.
  - Error-correction/translation textarea: Ctrl+Enter submits while typing in it.
  - MCQ: pressing `2` selects option b; while a text field elsewhere is focused, digits type normally; Ctrl+Enter checks then continues.
  - After a correct answer, Ctrl+Enter advances to the next question.

- [ ] **Step 6: Commit** — `git commit -am "feat(web): exercise runner keyboard shortcuts (ctrl+enter, ctrl+arrows, 1-4)"`.

---

### Task 5: "Làm bài tập →" CTA at the end of each lecture

Implements design item 4.

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx` (after `<MarkdownContent>` at line 47)

- [ ] **Step 1: Add the CTA block** (check `web/src/components/ui/button.tsx` for available `buttonVariants` sizes; use `size: "lg"` if defined, else default):

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
// ...
        <MarkdownContent content={lesson.lectureMd} />

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-8">
          <p className="text-caption text-muted-foreground">
            Đã đọc xong? Luyện tập ngay để mở khoá bài tiếp theo.
          </p>
          <Link
            href={`${base}/exercise`}
            className={cn(buttonVariants({ variant: "default" }), "w-full shadow-primary-glow sm:w-auto")}
          >
            Làm bài tập →
          </Link>
        </div>
```

- [ ] **Step 2: Verify** — scroll any lecture to the bottom at 375px (full-width button) and 1280px (centered auto-width); clicking navigates to `/learn/<phase>/<lesson>/exercise`.

- [ ] **Step 3: Commit** — `git commit -am "feat(web): end-of-lecture CTA to the lesson exercise"`.

---### Task 6: Remove the "Từ vựng" tab from lesson pages

Implements design item 3. The `/vocab` hub in the sidebar stays; only the lesson-scoped tab (and page) go.

**Files:**
- Modify: `web/src/components/LessonTabs.tsx` (lines 5-11)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/page.tsx` (replace body with a redirect)

- [ ] **Step 1: Shrink the tab defs** in `LessonTabs.tsx`:

```tsx
type LessonTabKey = "lecture" | "exercise";

const TAB_DEFS: { key: LessonTabKey; label: string; suffix: string }[] = [
  { key: "lecture", label: "Bài giảng", suffix: "" },
  { key: "exercise", label: "Bài tập", suffix: "/exercise" },
];
```

TypeScript now errors on any `active="vocab"` caller — that's the safety net.

- [ ] **Step 2: Redirect the old route** so bookmarks keep working — replace the whole `vocab/page.tsx` component body:

```tsx
import { redirect } from "next/navigation";

export default async function LessonVocabPage({
  params,
}: {
  params: Promise<{ phase: string; lesson: string }>;
}) {
  const { phase, lesson } = await params;
  redirect(`/learn/${phase}/${lesson}`);
}
```

Delete now-unused imports/components in that file; `npx tsc --noEmit` (or `npm run lint`) must come back clean — it will flag any other `active="vocab"` usages to remove.

- [ ] **Step 3: Verify** — lesson page shows two tabs; `/learn/<phase>/<lesson>/vocab` redirects to the lecture; sidebar "Từ vựng" hub still works.

- [ ] **Step 4: Commit** — `git commit -am "feat(web): drop lesson-level vocab tab (vocab hub remains)"`.

---

### Task 7: Remove "Cài đặt" from the desktop sidebar nav

Implements design item 5 (nav part; the display-name part lands in Task 8). The bottom profile card (already `href="/settings"`) becomes the single desktop entrance. **Keep** the `Cài đặt` link in the mobile `AppHeader` — mobile has no profile card, so removing it there would orphan Settings.

**Files:**
- Modify: `web/src/components/AppSidebar.tsx` (lines 5, 9-15)

- [ ] **Step 1: Remove the entry** — delete `{ href: "/settings", label: "Cài đặt", icon: Settings }` from `NAV_LINKS` and drop the now-unused `Settings` icon import. Per the design mockup, optionally add a hover affordance on the profile card (e.g. a `›` chevron span) — cosmetic, follow the mockup.

- [ ] **Step 2: Verify** — desktop sidebar shows 4 nav items; clicking the bottom profile card still opens `/settings`; mobile header unchanged.

- [ ] **Step 3: Commit** — `git commit -am "feat(web): settings reachable only via sidebar profile card on desktop"`.

---

### Task 8: Display name — onboarding step, settings editor, sidebar

`User.name` exists in `web/prisma/schema.prisma` (nullable) but nothing writes it; `AppSidebar` already renders `name ?? email`, so the sidebar fixes itself once the name is set. **No migration needed.**

**Files:**
- Create: `web/src/app/api/profile/name/route.ts`
- Create: `web/src/app/onboarding/name/page.tsx`
- Create: `web/src/components/SettingsNameForm.tsx`
- Modify: `web/src/app/(auth)/login/verify/page.tsx` (~line 63: onboarding redirect target)
- Modify: `web/src/app/(app)/settings/page.tsx` (add the name form)

**Interfaces:**
- Produces: `POST /api/profile/name` with JSON `{ name: string }` (1-50 chars after trim) → `{ ok: true }` | 400/401. Consumed by both the onboarding page and the settings form.

- [ ] **Step 1: API route** — `web/src/app/api/profile/name/route.ts`, modeled on `api/onboarding/path/route.ts`:

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

- [ ] **Step 2: Onboarding name page** — `web/src/app/onboarding/name/page.tsx`, cloned from the structure of `onboarding/path/page.tsx` (same progress bar shell, first-third filled):

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

      <h1 className="text-h1 font-extrabold lg:text-display">Bạn tên là gì?</h1>
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

- [ ] **Step 3: Route new users through it** — in `login/verify/page.tsx`, change the post-verify redirect for `needsOnboarding` from `/onboarding/path` to `/onboarding/name` (read the file first; keep the `/dashboard` branch untouched). Also adjust the `path` page's progress bar (`w-1/2` → `w-2/3`) since it is now step 2 of 3.

- [ ] **Step 4: Settings name form** — `web/src/components/SettingsNameForm.tsx` (client), same fetch/submit pattern as Step 2's page but compact (label `Tên hiển thị`, input + `Lưu` button, success text `Đã lưu tên mới.`, error text on 400). Then in `settings/page.tsx`, add a `details` accordion row (copy the "Mục tiêu học" accordion structure at lines 55-71, icon `👤`, title `Tên hiển thị`, subtitle `user.name ?? "Chưa đặt tên"`) containing `<SettingsNameForm initialName={user.name} />`. Add `router.refresh()` after a successful save so the server-rendered banner/sidebar update.

- [ ] **Step 5: Verify end-to-end** — log in with a **new** email (OTP echoes to logs in dev): flow is verify → name → path → placement; after setting a name, sidebar bottom card and settings banner show the name (email demoted to the secondary line); an existing user can edit their name in Settings and the sidebar updates after refresh.

- [ ] **Step 6: Commit** — `git commit -am "feat(web): display name — onboarding step, settings editor, profile API"`.

---

### Task 9: IELTS — skill-scoped test detail page

Implements design item 6. Hub tabs already deep-link `?skill=`; the detail page must render **only** that skill (no inner Tabs), the back-link must return to the hub on the right tab, and the answer key should show that skill's section.

**Files:**
- Modify: `web/src/app/(app)/ielts/page.tsx` (pass `initialSkill` from `searchParams`)
- Modify: `web/src/components/IeltsHub.tsx` (accept `initialSkill`, update copy)
- Modify: `web/src/app/(app)/ielts/[n]/page.tsx` (rewrite: single-skill view, drop Tabs)
- Create: `web/src/lib/ielts-answer-key.ts` + `web/src/lib/ielts-answer-key.test.ts`

**Interfaces:**
- Produces: `sliceAnswerKeyBySkill(md: string, skill: "reading" | "writing" | "speaking"): string` — returns the skill's section of an `answer_key.md`, or the full md when no matching heading is found (safe fallback).
- Consumes: existing `AnswerKeyAccordion({ answerKeyMd })` — unchanged, just fed the sliced string.

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

Run the tests → PASS. Spot-check against a real key: `npx tsx -e "..."` or temporarily log `sliceAnswerKeyBySkill(fs.readFileSync('../ielts_practice_tests/test_01/answer_key.md','utf8'), 'writing')` — headings vary across the 30 tests (`ĐÁP ÁN`, `ANSWER KEY`, EN/VI mixes), which is exactly why the fallback returns the full key.

- [ ] **Step 3: Hub keeps its tab across navigation.** In `ielts/page.tsx`, read `searchParams` and pass down:

```tsx
export default async function IeltsPage({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  // ...existing session + tests fetch...
  const { skill } = await searchParams;
  const initialSkill = skill === "writing" || skill === "speaking" ? skill : "reading";
  return <IeltsHub tests={tests} initialSkill={initialSkill} />;
}
```

In `IeltsHub.tsx`: `export function IeltsHub({ tests, initialSkill = "reading" }: { tests: ...; initialSkill?: IeltsSkill })` and `useState<IeltsSkill>(initialSkill)`. Update the hub subtitle to reflect skill-scoped navigation, e.g. `Chọn kỹ năng, sau đó chọn đề để luyện riêng kỹ năng đó.`

- [ ] **Step 4: Rewrite the detail page** `ielts/[n]/page.tsx` — remove the `Tabs` imports/JSX entirely:

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
const others = (["reading", "writing", "speaking"] as const).filter((s) => s !== activeSkill);

return (
  <div className="mx-auto max-w-3xl px-4 py-8">
    <Link href={`/ielts?skill=${activeSkill}`} className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
      ← Quay lại đề {SKILL_META[activeSkill].label}
    </Link>

    <div className="mb-1 flex items-center gap-3">
      <h1 className="text-h1 font-extrabold">Đề {test.number} — {SKILL_META[activeSkill].label}</h1>
      {!test.isComplete && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Chưa đủ nội dung</span>
      )}
    </div>
    <p className="mb-6 text-caption text-muted-foreground">
      {SKILL_META[activeSkill].meta}
      {" · Kỹ năng khác: "}
      {others.map((s, i) => (
        <span key={s}>
          {i > 0 && " · "}
          <Link href={`/ielts/${test.number}?skill=${s}`} className="font-semibold text-primary hover:underline">
            {SKILL_META[s].label}
          </Link>
        </span>
      ))}
    </p>

    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <TabBody content={content} emptyLabel={SKILL_META[activeSkill].empty} />
    </div>

    <AnswerKeyAccordion answerKeyMd={sliceAnswerKeyBySkill(test.answerKeyMd, activeSkill)} />
  </div>
);
```

(Keep the existing `TabBody` helper — it's just an empty-state wrapper. Match the Claude Design mockup for the header/badge treatment if one exists.)

- [ ] **Step 5: Verify** — hub: pick Writing tab → click Đề 05 → page shows only Writing (`Đề 5 — Writing`, `2 bài · 60 phút`); back-link returns to the hub with Writing still active; answer key accordion shows the Writing section (or full key on tests whose headings don't split); no frontmatter leak (Task 1); `npm test` PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat(web): skill-scoped IELTS test pages with skill-preserving hub navigation"`.

---

### Task 10: Redeploy on port 3000 (web + db + cloudflared together)

`docker-compose.yml` already publishes `${WEB_PORT:-3000}:3000` and the Cloudflare Zero Trust tunnel targets `web:3000`, so no compose/Makefile change is expected — this task verifies config and performs the cutover. **Do the cutover only with the user present** (it takes the public site through a restart).

**Files:**
- Verify only: `.env` (`WEB_PORT`), `docker-compose.yml`, `Makefile` (both have pre-existing uncommitted edits — review `git diff Makefile docker-compose.yml .env.example` first and reconcile with the user before committing anything here).

- [ ] **Step 1: Confirm port config** — `grep -E '^(WEB_PORT|POSTGRES_PORT)' .env` → expect `WEB_PORT=3000` (add/fix it if missing; `.env` is not committed).
- [ ] **Step 2: Cutover** — `make down` then `make up` (rebuilds the `web` image with all tasks above, then starts db → web → cloudflared).
- [ ] **Step 3: Re-seed with frontmatter stripping** — run the repo's seed flow against the running stack (Makefile `seed-all` / `bootstrap` path); confirm seed logs show lessons updating, not "skipped (unchanged)".
- [ ] **Step 4: Verify** — `curl -sI http://localhost:3000` returns 200/307; open the public tunnel URL and spot-check it serves the new UI; `docker compose ps` shows db/web/cloudflare all up.
- [ ] **Step 5: Commit** any intentional config reconciliation from Step 1's review, message `chore: reconcile deploy config for port-3000 cutover` — or nothing if no file changed.

---

## Verification (end-to-end, after all tasks)

Run `make up`, then walk the app in a browser at 1280px and 375px, light + dark:

1. **Frontmatter gone:** open a lecture (e.g. Bài 1 Simple Present) and IELTS Đề 1 reading/writing/speaking — no `id: "..."` block anywhere (also check placement test content).
2. **Runner layout:** lesson exercise on desktop — kicker/card/feedback/button in one centered column; wrong answer keeps the layout stable.
3. **Error-correction:** the `bai_tap.png` question shows one textarea with retype-the-sentence copy (no `Lỗi/Sửa` scaffold); the full corrected sentence is graded correct; a bare corrected phrase still passes; the original sentence unchanged fails.
4. **Shortcuts:** Ctrl+Enter checks/retries/continues on every question kind (including while typing in a textarea); Ctrl+←/→ hops between blanks in multi-blank questions; 1-4 picks MCQ options.
5. **Lecture flow:** two tabs only; "Làm bài tập →" CTA at the lecture end navigates to the exercise; `/vocab` lesson URLs redirect.
6. **Sidebar:** 4 nav items; profile card → settings; card shows the display name.
7. **Name flow:** fresh-email signup goes verify → name → goal → placement; name editable in Settings; sidebar/banner update.
8. **IELTS:** hub tab filters destination; test page is single-skill with skill-preserving back-link and a skill-scoped answer key.
9. **Deploy:** `http://localhost:3000` and the Cloudflare tunnel URL both serve the new build; `cd web && npm test` and `npm run lint` pass.
