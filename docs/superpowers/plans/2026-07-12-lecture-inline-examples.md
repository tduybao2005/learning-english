# Interactive Inline Lecture Examples — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run at most ONE subagent at a time (project rule).
>
> On execution start, save this plan verbatim to `docs/superpowers/plans/2026-07-12-lecture-inline-examples.md`.

## Context

Lecture pages ("Bài giảng") are currently static prose — learners read but never practice inside the lecture. This plan embeds small interactive fill-in examples at teaching points: a text input, **Gợi ý** (hint) button, **Kiểm tra** (check) button with retry (**Thử lại**) on wrong answers, and **Xem đáp án** (show answer) button.

Decisions made with the user:
- **Pilot scope**: infrastructure + examples authored into 1 lesson (`phase_1_foundation/lesson_01_simple_present/lecture.md`); broader rollout is a later plan.
- **Server-side grading** via a new API route — answers never reach the client.
- **No persistence**: state resets on refresh; no Prisma schema changes, no attempt rows.

**Goal:** Learners can attempt inline examples inside lecture pages with hint/check/retry/reveal, graded server-side.

**Architecture:** Examples are authored as ```` ```example ```` fenced blocks inside `lecture.md` (seeded verbatim into `Lesson.lectureMd` as today — no seeder changes). A new pure lib splits `lectureMd` server-side into markdown chunks + answer-free `SafeExample`s; the lecture server page renders alternating `<MarkdownContent>` and `<InlineExample>` (client). A stateless API route re-parses `lectureMd` on demand and grades via the existing `matchAnswer`.

**Tech Stack:** Next.js App Router (RSC + client component), Vitest (co-located, node env by default — component tests need `// @vitest-environment jsdom`), zod, existing `@/lib/grading/{normalize,match}`, `@/components/ui/{button,input}`, Prisma read-only.

## Global Constraints

- No Prisma schema changes; no new DB rows; nothing persisted.
- Answers never serialized to the client — not in RSC props, not in API responses except after a correct check or explicit reveal.
- Vietnamese UI labels exactly: `Kiểm tra` / `Thử lại` / `Gợi ý` / `Xem đáp án`. Design tokens only (`--success`, `--destructive`, `--primary`…), no new colors (docs/design/webapp-export/WEBAPP_PROMPT.md).
- Content edits follow CLAUDE.md: bilingual convention (VN framing, EN sentences); after editing content run `python3 scripts/build_index.py` and commit `index/manifest.json` + `docs/STATUS.md`; re-seed (`make seed-all`) so the DB picks up new `lectureMd` (contentHash change triggers update).
- Web commands run from `web/`: `npm test -- <filter>`, `npm run lint`, `npx tsc --noEmit`.
- Work directly on `main`; one subagent at a time.

## Authoring syntax (grammar)

```example
id: sp-1
prompt: She ___ (go) to school every day.
hint: Chủ ngữ ngôi thứ 3 số ít → thêm -es.
answer: goes
```

- All four keys required, one per line, `key: value`. `id` unique within a lecture.
- `answer` supports `/`-separated variants (repo convention): `answer: doesn't eat / does not eat`.
- Prompt may contain one `___` blank (3+ underscores, same `BLANK_RE` as `runner/QuestionCard.tsx`). Pilot = single answer per example.
- Malformed/duplicate blocks fail soft: skipped by the parser, left rendering as an ordinary code block — never crash the page.

---

## Task 1: Parser lib `lecture-examples.ts`

**Files:**
- Create: `web/src/lib/lecture-examples.ts`
- Test: `web/src/lib/lecture-examples.test.ts`

**Interfaces:**
- Consumes: raw `lectureMd: string` (may include frontmatter).
- Produces:
  ```ts
  export interface LectureExample { id: string; prompt: string; hint: string; answer: string; variants: string[] }
  export interface SafeExample { id: string; prompt: string; hint: string }
  export type LectureSegment =
    | { type: "markdown"; content: string }
    | { type: "example"; example: SafeExample };
  export function parseLectureExamples(lectureMd: string): LectureExample[]   // SERVER-ONLY (has answers)
  export function splitLectureSegments(lectureMd: string): LectureSegment[]   // safe for RSC → client
  ```

- [ ] **Step 1: Write the failing tests** in `web/src/lib/lecture-examples.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLectureExamples, splitLectureSegments } from "./lecture-examples";

const MD = [
  "# Title",
  "",
  "Intro paragraph.",
  "",
  "```example",
  "id: sp-1",
  "prompt: She ___ (go) to school every day.",
  "hint: Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
  "answer: goes",
  "```",
  "",
  "---",
  "",
  "More text.",
  "",
  "```example",
  "id: sp-2",
  "prompt: They ___ (not / like) coffee.",
  "hint: Phủ định với chủ ngữ số nhiều.",
  "answer: don't like / do not like",
  "```",
  "",
].join("\n");

describe("parseLectureExamples", () => {
  it("extracts full examples with /-separated variants", () => {
    const examples = parseLectureExamples(MD);
    expect(examples).toHaveLength(2);
    expect(examples[0]).toEqual({
      id: "sp-1",
      prompt: "She ___ (go) to school every day.",
      hint: "Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
      answer: "goes",
      variants: ["goes"],
    });
    expect(examples[1].variants).toEqual(["don't like", "do not like"]);
  });

  it("skips malformed blocks (missing required key)", () => {
    const bad = "```example\nid: x\nprompt: a ___ b\n```\n";
    expect(parseLectureExamples(bad)).toEqual([]);
  });

  it("skips duplicate ids after the first", () => {
    const dup = MD.replace("id: sp-2", "id: sp-1");
    expect(parseLectureExamples(dup)).toHaveLength(1);
  });

  it("strips frontmatter before scanning", () => {
    const withFm = `---\nid: "x"\n---\n${MD}`;
    expect(parseLectureExamples(withFm)).toHaveLength(2);
  });
});

describe("splitLectureSegments", () => {
  it("alternates markdown chunks and safe examples, never leaks answers", () => {
    const segs = splitLectureSegments(MD);
    expect(segs.map((s) => s.type)).toEqual(["markdown", "example", "markdown", "example"]);
    const ex = segs[1] as { type: "example"; example: { id: string } };
    expect(ex.example).toEqual({
      id: "sp-1",
      prompt: "She ___ (go) to school every day.",
      hint: "Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
    });
    expect(JSON.stringify(segs)).not.toContain("goes");
    expect(JSON.stringify(segs)).not.toContain("answer");
  });

  it("leaves a malformed example fence in the markdown chunk", () => {
    const bad = "Text.\n\n```example\nid: x\n```\n\nAfter.";
    const segs = splitLectureSegments(bad);
    expect(segs).toHaveLength(1);
    expect((segs[0] as { content: string }).content).toContain("```example");
  });

  it("returns one markdown segment for a lecture without examples", () => {
    expect(splitLectureSegments("# Hi\n\nBody.")).toEqual([
      { type: "markdown", content: "# Hi\n\nBody." },
    ]);
  });
});
```

- [ ] **Step 2: Run** `cd web && npm test -- lecture-examples` — expect FAIL: `Cannot find module './lecture-examples'`.

- [ ] **Step 3: Implement** `web/src/lib/lecture-examples.ts`:

```ts
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
  return { id: fields.id!, prompt: fields.prompt!, hint: fields.hint!, answer, variants };
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
```

- [ ] **Step 4: Run** `npm test -- lecture-examples` — expect 7 passed.
- [ ] **Step 5: Commit**

```bash
git add web/src/lib/lecture-examples.ts web/src/lib/lecture-examples.test.ts
git commit -m "feat(lecture): add inline-example parser and segment splitter

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Server-side grading (pure helper + API route)

**Files:**
- Create: `web/src/lib/example-grading.ts` (pure, mirrors `placement-grading.ts` pattern)
- Create: `web/src/app/api/lessons/[lessonId]/example-check/route.ts`
- Test: `web/src/lib/example-grading.test.ts`

**Interfaces:**
- Consumes: `matchAnswer(input, question: MatchQuestion): MatchResult` and `normalize(s)` from `@/lib/grading/*` — verified shapes: `MatchQuestion = { kind: QuestionKind; isOpenEnded: boolean; variants: { normalized: string }[] }` (`web/src/lib/grading/match.ts:23`), `MatchResult = { correct: true; matchType: "EXACT"|"VARIANT"|"FUZZY"|"MANUAL" } | { correct: false }`. Also `parseLectureExamples` (Task 1), `getSessionUser()` from `@/lib/auth/session`, `db` from `@/lib/db`.
- Produces:
  ```ts
  export type ExampleCheckResult =
    | { revealed: true; answer: string }
    | { correct: true; matchType: "EXACT" | "VARIANT" | "FUZZY" | "MANUAL"; answer: string }
    | { correct: false };
  export function gradeExample(example: LectureExample, input: string, reveal: boolean): ExampleCheckResult
  ```
  HTTP: `POST /api/lessons/:lessonId/example-check`, body `{ exampleId: string, input: string, reveal?: boolean }` → 200 with `ExampleCheckResult`; errors `{ ok: false, reason: "unauthorized"|"invalid"|"not_found" }` with 401/400/404 (mirrors `web/src/app/api/listening/[slug]/check/route.ts`).

- [ ] **Step 1: Write the failing tests** in `web/src/lib/example-grading.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gradeExample } from "./example-grading";
import type { LectureExample } from "./lecture-examples";

const EX: LectureExample = {
  id: "sp-2",
  prompt: "They ___ (not / like) coffee.",
  hint: "Phủ định.",
  answer: "don't like / do not like",
  variants: ["don't like", "do not like"],
};

describe("gradeExample", () => {
  it("accepts an exact variant (case/punctuation-insensitive)", () => {
    expect(gradeExample(EX, "  Don't like.", false)).toEqual({
      correct: true, matchType: "EXACT", answer: "don't like / do not like",
    });
  });
  it("accepts contraction-equivalent forms not listed verbatim", () => {
    const ex = { ...EX, answer: "don't like", variants: ["don't like"] };
    expect(gradeExample(ex, "do not like", false)).toMatchObject({ correct: true });
  });
  it("rejects a wrong answer without leaking the answer", () => {
    const res = gradeExample(EX, "doesn't likes", false);
    expect(res).toEqual({ correct: false });
    expect(JSON.stringify(res)).not.toContain("like");
  });
  it("rejects empty input", () => {
    expect(gradeExample(EX, "   ", false)).toEqual({ correct: false });
  });
  it("returns the raw answer on reveal regardless of input", () => {
    expect(gradeExample(EX, "", true)).toEqual({
      revealed: true, answer: "don't like / do not like",
    });
  });
});
```

- [ ] **Step 2: Run** `npm test -- example-grading` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `web/src/lib/example-grading.ts`:

```ts
import { normalize } from "@/lib/grading/normalize";
import { matchAnswer } from "@/lib/grading/match";
import type { LectureExample } from "@/lib/lecture-examples";

export type ExampleCheckResult =
  | { revealed: true; answer: string }
  | { correct: true; matchType: "EXACT" | "VARIANT" | "FUZZY" | "MANUAL"; answer: string }
  | { correct: false };

/**
 * Grade one inline lecture example. FILL_BLANK semantics: exact/variant
 * (contraction) matching only — FILL_BLANK is not fuzzy-eligible in match.ts.
 * The raw answer string leaves the server only on reveal or a correct check.
 */
export function gradeExample(
  example: LectureExample,
  input: string,
  reveal: boolean,
): ExampleCheckResult {
  if (reveal) {
    return { revealed: true, answer: example.answer };
  }
  const result = matchAnswer(input, {
    kind: "FILL_BLANK",
    isOpenEnded: false,
    variants: example.variants.map((v) => ({ normalized: normalize(v) })),
  });
  if (!result.correct) return { correct: false };
  return { correct: true, matchType: result.matchType, answer: example.answer };
}
```

- [ ] **Step 4: Run** `npm test -- example-grading` — expect 5 passed. (If the first test returns `matchType: "VARIANT"` instead of `"EXACT"`, relax that assertion to `toMatchObject({ correct: true, answer: EX.answer })` — either matchType is acceptable UX-wise.)

- [ ] **Step 5: Implement the route** `web/src/app/api/lessons/[lessonId]/example-check/route.ts` (thin I/O shell; no route-level unit tests, matching repo precedent — covered by Task 6 manual verification):

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { parseLectureExamples } from "@/lib/lecture-examples";
import { gradeExample } from "@/lib/example-grading";

const bodySchema = z.object({
  exampleId: z.string().min(1),
  input: z.string(),
  reveal: z.boolean().optional(),
});

/**
 * Stateless check for an inline lecture example. Deliberately persists
 * nothing — lecture examples are teaching aids, not graded exercises. The
 * example definition lives inside Lesson.lectureMd (parsed on demand), so
 * no new Prisma models are needed, and answers never reach the client
 * except on reveal or after a correct check.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { lessonId } = await params;

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { exampleId, input, reveal } = parsed.data;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { lectureMd: true },
  });
  if (!lesson) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const example = parseLectureExamples(lesson.lectureMd).find((e) => e.id === exampleId);
  if (!example) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  return NextResponse.json(gradeExample(example, input, reveal === true));
}
```

Before writing, glance at `web/src/app/api/listening/[slug]/check/route.ts` and copy its exact zod/error-shape conventions if they differ from the above.

- [ ] **Step 6: Run** `npx tsc --noEmit` — no errors.
- [ ] **Step 7: Commit**

```bash
git add web/src/lib/example-grading.ts web/src/lib/example-grading.test.ts "web/src/app/api/lessons/[lessonId]/example-check/route.ts"
git commit -m "feat(lecture): server-side grading endpoint for inline examples

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `InlineExample` client component

**Files:**
- Create: `web/src/components/InlineExample.tsx`
- Test: `web/src/components/InlineExample.test.tsx`

**Interfaces:**
- Consumes: `SafeExample` (Task 1); `Button` (variants `default`/`outline`/`ghost`, `size="sm"`) from `@/components/ui/button`; `Input` from `@/components/ui/input` (has built-in `aria-invalid` red-ring styling); `cn` from `@/lib/utils`; the Task 2 API via `fetch`.
- Produces: `export function InlineExample({ lessonId, example }: { lessonId: string; example: SafeExample })`.
- State: `status: "idle"|"checking"|"correct"|"incorrect"|"revealed"`, `hintShown: boolean`, `input: string`, `answer: string|null`. Typing while `incorrect` returns to `idle` (button reads `Kiểm tra` again); `correct`/`revealed` are terminal (input + buttons disabled); Enter submits; Gợi ý is independent of status.

- [ ] **Step 1: Write the failing tests** in `web/src/components/InlineExample.test.tsx`. Vitest env is `node` by default (`web/vitest.config.ts:22`), so the jsdom pragma is mandatory. Mirror the setup of an existing component test (e.g. `web/src/components/ExerciseReview.test.tsx`) for Testing Library imports/config:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InlineExample } from "./InlineExample";

const example = {
  id: "sp-1",
  prompt: "She ___ (go) to school every day.",
  hint: "Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
};

function mockFetch(response: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(response) });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InlineExample", () => {
  it("renders prompt and Vietnamese action labels, hint hidden initially", () => {
    mockFetch({});
    render(<InlineExample lessonId="l1" example={example} />);
    expect(screen.getByText(/She/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Gợi ý" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Xem đáp án" })).toBeDefined();
    expect(screen.queryByText(example.hint)).toBeNull();
  });

  it("shows the hint after clicking Gợi ý", () => {
    mockFetch({});
    render(<InlineExample lessonId="l1" example={example} />);
    fireEvent.click(screen.getByRole("button", { name: "Gợi ý" }));
    expect(screen.getByText(new RegExp(example.hint))).toBeDefined();
  });

  it("checks via API and shows success state on correct", async () => {
    const fetchFn = mockFetch({ correct: true, matchType: "EXACT", answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    await waitFor(() => expect(screen.getByText(/Chính xác!/)).toBeDefined());
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/lessons/l1/example-check",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ exampleId: "sp-1", input: "goes" }),
      }),
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("shows Thử lại on incorrect and allows retype + re-check", async () => {
    mockFetch({ correct: false });
    render(<InlineExample lessonId="l1" example={example} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Thử lại" })).toBeDefined());
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeDefined();
  });

  it("reveals the answer via Xem đáp án and disables further input", async () => {
    mockFetch({ revealed: true, answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem đáp án" }));
    await waitFor(() => expect(screen.getByText(/goes/)).toBeDefined());
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Kiểm tra" })).toBeNull();
  });

  it("submits on Enter", async () => {
    const fetchFn = mockFetch({ correct: true, matchType: "EXACT", answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run** `npm test -- InlineExample` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `web/src/components/InlineExample.tsx`:

```tsx
"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SafeExample } from "@/lib/lecture-examples";

type Status = "idle" | "checking" | "correct" | "incorrect" | "revealed";

const BLANK_RE = /_{3,}/; // same convention as runner/QuestionCard

/** Renders the prompt with the ___ blank shown as a styled gap. */
function Prompt({ prompt }: { prompt: string }) {
  const parts = prompt.split(BLANK_RE);
  if (parts.length === 1) return <p className="mb-2 leading-relaxed">{prompt}</p>;
  return (
    <p className="mb-2 leading-relaxed">
      {parts[0]}
      <span className="mx-1 inline-block min-w-16 border-b-2 border-dashed border-primary/50 align-baseline" />
      {parts.slice(1).join(" ___ ")}
    </p>
  );
}

export function InlineExample({
  lessonId,
  example,
}: {
  lessonId: string;
  example: SafeExample;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [hintShown, setHintShown] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const done = status === "correct" || status === "revealed";
  const busy = status === "checking";

  async function post(body: { exampleId: string; input: string; reveal?: boolean }) {
    const res = await fetch(`/api/lessons/${lessonId}/example-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("request_failed");
    return res.json();
  }

  async function handleCheck() {
    if (done || busy || input.trim().length === 0) return;
    setStatus("checking");
    try {
      const data = await post({ exampleId: example.id, input });
      if (data.correct) {
        setAnswer(typeof data.answer === "string" ? data.answer : null);
        setStatus("correct");
      } else {
        setStatus("incorrect");
      }
    } catch {
      setStatus("idle");
    }
  }

  async function handleReveal() {
    if (done || busy) return;
    setStatus("checking");
    try {
      const data = await post({ exampleId: example.id, input: "", reveal: true });
      setAnswer(typeof data.answer === "string" ? data.answer : null);
      setStatus("revealed");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div
      className={cn(
        "my-6 rounded-lg border border-border bg-muted/30 p-4",
        status === "correct" && "border-success/50",
        status === "revealed" && "border-primary/40",
      )}
    >
      <p className="mb-2 text-caption font-semibold text-muted-foreground">✏️ Thử ngay</p>
      <Prompt prompt={example.prompt} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (status === "incorrect") setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCheck();
          }}
          disabled={done || busy}
          aria-invalid={status === "incorrect" || undefined}
          aria-label="Câu trả lời"
          placeholder="Điền câu trả lời…"
          className="sm:max-w-60"
        />
        <div className="flex gap-2">
          {!done && (
            <Button size="sm" onClick={handleCheck} disabled={busy || input.trim() === ""}>
              {status === "incorrect" ? "Thử lại" : "Kiểm tra"}
            </Button>
          )}
          {!hintShown && !done && (
            <Button size="sm" variant="outline" onClick={() => setHintShown(true)} disabled={busy}>
              Gợi ý
            </Button>
          )}
          {!done && (
            <Button size="sm" variant="ghost" onClick={handleReveal} disabled={busy}>
              Xem đáp án
            </Button>
          )}
        </div>
      </div>

      {hintShown && !done && (
        <p className="mt-2 text-sm text-muted-foreground">💡 {example.hint}</p>
      )}
      {status === "incorrect" && (
        <p className="mt-2 text-sm font-medium text-destructive">Chưa đúng. Hãy thử lại!</p>
      )}
      {status === "correct" && (
        <p className="mt-2 text-sm font-medium text-success">
          Chính xác!{answer ? ` Đáp án: ${answer}` : ""}
        </p>
      )}
      {status === "revealed" && answer && (
        <p className="mt-2 text-sm font-medium text-foreground">
          Đáp án: <span className="text-primary">{answer}</span>
        </p>
      )}
    </div>
  );
}
```

Adjust `Input`/`Button` props to match the real component APIs in `web/src/components/ui/` if they differ (e.g. how `Input` forwards `onKeyDown` through @base-ui).

- [ ] **Step 4: Run** `npm test -- InlineExample` — expect 6 passed; then `npm test` — full suite green.
- [ ] **Step 5: Commit**

```bash
git add web/src/components/InlineExample.tsx web/src/components/InlineExample.test.tsx
git commit -m "feat(lecture): InlineExample interactive card component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Lecture page integration

**Files:**
- Modify: `web/src/components/MarkdownContent.tsx:88-89` (add `stripFrontmatter` prop)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx:50` (segment rendering)

**Interfaces:**
- Consumes: `splitLectureSegments` (Task 1), `InlineExample` (Task 3).
- Produces: `MarkdownContent({ content, stripFrontmatter = true })` — default preserves behavior for all existing callers.

- [ ] **Step 1:** In `MarkdownContent.tsx` change the export signature:

```tsx
export function MarkdownContent({
  content,
  stripFrontmatter = true,
}: {
  content: string;
  stripFrontmatter?: boolean;
}) {
  // A mid-lecture segment from splitLectureSegments may begin with a `---`
  // thematic break, which the frontmatter regex would swallow.
  const body = stripFrontmatter ? content.replace(FRONT_MATTER_RE, "") : content;
```

(rest of the component unchanged).

- [ ] **Step 2:** In `page.tsx`, add imports:

```tsx
import { splitLectureSegments } from "@/lib/lecture-examples";
import { InlineExample } from "@/components/InlineExample";
```

above the return add `const segments = splitLectureSegments(lesson.lectureMd);`, and replace line 50 (`<MarkdownContent content={lesson.lectureMd} />`) with:

```tsx
{segments.map((segment, i) =>
  segment.type === "markdown" ? (
    <MarkdownContent key={i} content={segment.content} stripFrontmatter={false} />
  ) : (
    <InlineExample key={segment.example.id} lessonId={lesson.id} example={segment.example} />
  ),
)}
```

Notes: only `{lessonId, example: SafeExample}` cross the RSC→client boundary — answers never serialize. `extractToc(lesson.lectureMd)` at `page.tsx:38` stays on the full string; `extractToc` already skips fenced blocks (`web/src/lib/toc.ts:30-34`), so the TOC is unaffected.

- [ ] **Step 3: Run** `npm test`, `npx tsc --noEmit`, `npm run lint` — all green.
- [ ] **Step 4: Commit**

```bash
git add web/src/components/MarkdownContent.tsx "web/src/app/(app)/learn/[phase]/[lesson]/page.tsx"
git commit -m "feat(lecture): render interactive inline examples in lecture pages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Author pilot examples + reindex + reseed

**Files:**
- Modify: `phase_1_foundation/lesson_01_simple_present/lecture.md`
- Regenerated: `index/manifest.json`, `docs/STATUS.md` (via `scripts/build_index.py`)

- [ ] **Step 1:** Insert 4 example blocks at teaching points, each between blank lines, outside tables/blockquotes, right after the subsection it reinforces (locate the actual `###` headings in the file first — do not modify frontmatter or any existing content):

After **1.1 Câu khẳng định**:
~~~
```example
id: sp-affirm-1
prompt: My brother ___ (work) in a hospital.
hint: "My brother" là ngôi thứ 3 số ít → động từ thêm -s.
answer: works
```
~~~

After the **-s/-es spelling rules** subsection:
~~~
```example
id: sp-es-1
prompt: She always ___ (finish) her homework before dinner.
hint: Động từ tận cùng bằng -sh → thêm -es.
answer: finishes
```
~~~

After **Câu phủ định**:
~~~
```example
id: sp-neg-1
prompt: He ___ (not / eat) meat.
hint: Ngôi thứ 3 số ít phủ định dùng "doesn't" + động từ nguyên thể.
answer: doesn't eat / does not eat
```
~~~

After **Câu hỏi**:
~~~
```example
id: sp-q-1
prompt: ___ your sister like music? (Do / Does)
hint: "your sister" là ngôi thứ 3 số ít.
answer: Does
```
~~~

- [ ] **Step 2: Sanity-check the parse** (read-only):

```bash
cd web && npx tsx -e "import {parseLectureExamples} from './src/lib/lecture-examples'; import {readFileSync} from 'fs'; console.log(parseLectureExamples(readFileSync('../phase_1_foundation/lesson_01_simple_present/lecture.md','utf8')).map(e=>e.id))"
```

Expected: `[ 'sp-affirm-1', 'sp-es-1', 'sp-neg-1', 'sp-q-1' ]`.

- [ ] **Step 3: Reindex:** `cd /home/ncd/learnspaces/learning_english && python3 scripts/build_index.py` — regenerates `index/manifest.json` + `docs/STATUS.md`.
- [ ] **Step 4: Reseed** so `Lesson.lectureMd` picks up the change (contentHash changes → ingest updates the row): `make seed-all` (Docker stack must be up: `make up` first if needed).
- [ ] **Step 5: Commit**

```bash
git add phase_1_foundation/lesson_01_simple_present/lecture.md index/manifest.json docs/STATUS.md
git commit -m "content(lesson-01): pilot interactive inline examples in lecture

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Manual end-to-end verification

No file changes — read-only verification against the running app (`cd web && npm run dev` against local DB, or the Docker stack).

- [ ] Log in and open the lesson-01 lecture page (follow the dashboard link to get the real `/learn/<phase-slug>/<lesson-slug>` URL).
- [ ] Four "✏️ Thử ngay" cards appear at the authored positions; no raw ```` ```example ```` blocks render; the TOC sidebar is unchanged.
- [ ] **Answer secrecy:** View Source / RSC payload — search for `works`, `finishes`, `doesn't eat`: must NOT appear before checking. Network tab: answers appear only in `example-check` responses after correct/reveal.
- [ ] **Flow on `sp-neg-1`:** type `doesn't eats` → Kiểm tra → red "Chưa đúng. Hãy thử lại!", input red ring, button reads "Thử lại". Retype `does not eat` → check → green "Chính xác! Đáp án: doesn't eat / does not eat", input disabled.
- [ ] On another card: Gợi ý reveals the hint; Xem đáp án shows the answer and disables the card; Enter key submits.
- [ ] **API robustness:** `curl -X POST localhost:3000/api/lessons/<id>/example-check -d '{}'` without session → 401; authenticated with unknown `exampleId` → 404.
- [ ] Refresh the page → all cards reset (expected: no persistence).
- [ ] Final gate: `npm test` and `npm run build` — green.

---

## Critical files

- `web/src/lib/lecture-examples.ts` (new — parser/splitter, core of the feature)
- `web/src/lib/example-grading.ts` + `web/src/app/api/lessons/[lessonId]/example-check/route.ts` (new — server grading)
- `web/src/components/InlineExample.tsx` (new — client UI)
- `web/src/components/MarkdownContent.tsx`, `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx` (integration)
- `phase_1_foundation/lesson_01_simple_present/lecture.md` (pilot content)

Reused existing code: `web/src/lib/grading/normalize.ts`, `web/src/lib/grading/match.ts` (`matchAnswer`), `web/src/lib/toc.ts` (`extractToc`, unchanged), `web/src/components/ui/{button,input}.tsx`, auth via `@/lib/auth/session`, route conventions from `web/src/app/api/listening/[slug]/check/route.ts`.
