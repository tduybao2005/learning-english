# Redesign Listening + Placement-Listening Layouts via Claude Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** written 2026-07-10, approved, **not yet executed**. No code has been changed.

**Goal:** Redesign the layout of the listening hub (`/listening`), the listening set page (`/listening/[slug]`), and the listening step of the first-login placement test (`/onboarding/placement`) — designing in the existing Claude Design project with the app's *real* components rather than letting the design agent invent them.

**Architecture:** The design agent can only build with components that live in the design system. Three of the four surfaces we want to redesign are not there yet: the hub's level cards are inline markup in `page.tsx`, `EmptyState` imports `next/link`, and `PlacementWizard` imports `useRouter`. We extract each blocker the same way `AppHeader`/`AppSidebar` were done — inject the effect, never stub it — sync the result, design in Claude Design, then port the chosen layouts back into the app.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/base-ui · Prisma · vitest 4 · design-sync → claude.ai/design

**Design project:** https://claude.ai/design/p/c65cc8d7-1c60-4c55-98e9-8c2555892ad3 (currently 17 components, all graded `good`)

---

## Context

The user wants to redesign two screens. Reading the code shows the design system can only partly support that today:

| Surface | Built from | In the DS? |
|---|---|---|
| `/listening/[slug]` | `ListeningSetView` (→ `AudioPlayer`, `ListeningRunner`, `QuestionCard`) | **yes** |
| `/listening` hub | inline `<Link>` cards + level badge, in `page.tsx`; `EmptyState` | **no** |
| `/onboarding/placement` listening step | `PlacementWizard` (→ `AudioPlayer`, `QuestionCard`, `MarkdownContent`) | **no** |

Whatever is missing, the design agent rebuilds from primitives. It will look on-brand (tokens + conventions header enforce that) but it will not be *your* component, and an engineer cannot paste it back. So the redesign is only worth doing after the missing pieces are real DS components.

The blockers are small and identical in shape to the shell extraction already merged in `09b1c24`:

- `EmptyState` (`web/src/components/EmptyState.tsx`) — one `import Link from "next/link"`.
- Hub level card + badge — not components at all; inline in `web/src/app/(app)/listening/page.tsx:70-92`, styled via `LEVEL_META` in `web/src/lib/listening-ui.ts`.
- `PlacementWizard` (`web/src/components/PlacementWizard.tsx`) — one `useRouter()`, used once at line 212 (`router.push("/onboarding/placement/result")`).

`web/src/lib/listening-ui.ts` uses `import type { CefrLevel }` — a **type-only** import, erased at compile, so `LEVEL_META` bundles into the DS with no Prisma runtime. Reuse it; do not duplicate the badge classes.

Today's 229 tests are pure logic (`vitest.config.ts` → `include: ["src/**/*.test.ts"]`, `environment: "node"`). Nothing touches the UI, so green tests would prove nothing about these extractions. Task 1 fixes that; every later extraction is then test-driven. This is the payoff of extraction: `PlacementWizard` cannot be unit-tested today because it calls `useRouter()`.

**Intended outcome:** four new DS components (21 total), two redesigned screens ported back into the app, and a UI test harness the repo did not have.

---

## Global Constraints

- **UI copy is Vietnamese.** English appears only inside lesson content. Applies to every new component, test fixture, and preview.
- **Semantic tokens only** — `bg-card`, `text-muted-foreground`, `bg-success-bg`, `text-primary`, the DS type scale `text-h1/h2/body/caption`. Never a hex or raw `oklch()`. Dark mode must keep working untouched.
- **Never stub `next/link`, `next/navigation`, `next-auth`, or `next-themes`** to make a preview render. Inject the effect via a prop; keep the effect in the app via a thin `*Connected` wrapper.
- **`linkComponent` has NO default value.** A default of `"a"` lets a forgotten prop silently downgrade every link to a full page load — green build, green tests, no error. Required prop ⇒ `TS2739` at compile time.
- **A server component cannot receive a function prop.** `app/(app)/listening/page.tsx` and `app/onboarding/placement/page.tsx` are both server components. Pass `React.ReactNode` slots, or move the callback into a `"use client"` wrapper.
- **Design-sync build order is mandatory:** `node .design-sync/fetch-fonts.mjs` → `node .design-sync/build-css.mjs` → converter. `cfg.cssEntry` is copied verbatim; the converter never runs Tailwind.
- **All design-sync browser commands need** `DS_CHROMIUM_PATH=/usr/bin/google-chrome`.
- **`.design-sync/conventions.md` and the `@source inline(...)` safelist in `.design-sync/build-css.mjs` must stay in sync.** A class named in the header but absent from the safelist emits no CSS.
- Work happens directly on `main`. Commit after each task.
- After adding/removing content files run `python3 scripts/build_index.py` (not expected here — this plan touches no lesson content).

---

## File Structure

**Create**
- `web/src/components/ListeningSetCard.tsx` — one listening set as a link card (icon, title, question count, duration).
- `web/src/components/LevelBadge.tsx` — CEFR pill, reads `LEVEL_META`.
- `web/src/components/PlacementWizardConnected.tsx` — `"use client"`; owns `useRouter()`.
- `web/src/components/EmptyState.test.tsx`, `ListeningSetCard.test.tsx`, `LevelBadge.test.tsx`, `PlacementWizard.test.tsx`
- `.design-sync/previews/EmptyState.tsx`, `LevelBadge.tsx`, `ListeningSetCard.tsx`, `PlacementWizard.tsx`

**Modify**
- `web/vitest.config.ts` — jsdom harness.
- `web/package.json` — 3 dev deps.
- `web/src/components/EmptyState.tsx` — `linkComponent` prop.
- `web/src/components/PlacementWizard.tsx` — `onFinished` prop replaces `useRouter`.
- `web/src/app/(app)/listening/page.tsx` — consume the two new components.
- `web/src/app/onboarding/placement/page.tsx` — render `PlacementWizardConnected`.
- `web/.ds-entry.tsx`, `.design-sync/config.json`, `.design-sync/conventions.md`, `.design-sync/NOTES.md`

---

## Task 1: UI test harness

**Files:**
- Modify: `web/package.json`, `web/vitest.config.ts`
- Test: `web/src/components/LevelBadge.test.tsx` (smoke, proves the harness)

**Interfaces:**
- Produces: the ability to `render()` a component in `*.test.tsx` under jsdom. Every later task depends on this.

- [ ] **Step 1: Install dev dependencies**

```bash
cd web
npm i -D jsdom @testing-library/react @testing-library/dom
```

`@testing-library/react` v16 needs `@testing-library/dom` as an explicit peer under React 19.

- [ ] **Step 2: Extend `web/vitest.config.ts`**

Keep `environment: "node"` as the default so the 229 existing logic tests stay fast; opt individual UI files into jsdom with a docblock. `jsx: "automatic"` is required because `tsconfig.json` sets `"jsx": "preserve"` (Next compiles JSX, vitest otherwise would not).

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // tsconfig sets jsx:"preserve" for Next; vitest needs a real transform.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
```

- [ ] **Step 3: Write the failing smoke test**

`web/src/components/LevelBadge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { LevelBadge } from "@/components/LevelBadge";

test("hiển thị mã cấp độ và nhãn tiếng Việt", () => {
  render(<LevelBadge level="B1" />);
  expect(screen.getByText(/B1/)).toBeDefined();
  expect(screen.getByText(/Trung cấp/)).toBeDefined();
});
```

- [ ] **Step 4: Run it — must fail on the missing module**

Run: `cd web && npm test -- src/components/LevelBadge.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/LevelBadge"`.

This failure is the point: it proves jsdom + the JSX transform are working and only the component is missing. A failure like `ReferenceError: document is not defined` means the docblock was dropped; `Unexpected token <` means `esbuild.jsx` was not applied.

- [ ] **Step 5: Commit the harness**

```bash
cd web && git add package.json package-lock.json vitest.config.ts src/components/LevelBadge.test.tsx
git commit -m "test: add jsdom + testing-library harness for UI tests

The 229 existing tests are pure logic (include: src/**/*.test.ts,
environment: node), so nothing covered the UI layer. Extracting the
listening + placement components is only safe with a harness that can
actually render them."
```

---

## Task 2: `LevelBadge` + `ListeningSetCard`

**Files:**
- Create: `web/src/components/LevelBadge.tsx`, `web/src/components/ListeningSetCard.tsx`
- Test: `web/src/components/LevelBadge.test.tsx` (from Task 1), `web/src/components/ListeningSetCard.test.tsx`
- Modify: `web/src/app/(app)/listening/page.tsx`

**Interfaces:**
- Consumes: `LEVEL_META`, `LEVEL_ORDER` from `web/src/lib/listening-ui.ts` (do not re-derive the badge classes).
- Produces:
  - `LevelBadge({ level: CefrLevel; className?: string })`
  - `ListeningSetCard({ href: string; title: string; questionCount: number; durationLabel?: string; linkComponent: React.ElementType; className?: string })`

- [ ] **Step 1: Make the Task-1 smoke test pass — write `LevelBadge`**

`web/src/components/LevelBadge.tsx`:

```tsx
import type { CefrLevel } from "@prisma/client";

import { LEVEL_META } from "@/lib/listening-ui";
import { cn } from "@/lib/utils";

/** CEFR pill: level code plus its Vietnamese label. Colours come from
 * LEVEL_META (semantic tokens only), so dark mode needs no extra work. */
export function LevelBadge({ level, className }: { level: CefrLevel; className?: string }) {
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-bold",
        meta.badgeClass,
        className,
      )}
    >
      {level} · {meta.labelVi}
    </span>
  );
}
```

- [ ] **Step 2: Run it — must pass**

Run: `cd web && npm test -- src/components/LevelBadge.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 3: Write the failing `ListeningSetCard` test**

`web/src/components/ListeningSetCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ListeningSetCard } from "@/components/ListeningSetCard";

test("render tiêu đề, số câu và thời lượng, dùng linkComponent được truyền vào", () => {
  render(
    <ListeningSetCard
      href="/listening/practice_a2_02"
      title="At the Library"
      questionCount={40}
      durationLabel="8:20"
      linkComponent="a"
    />,
  );
  const link = screen.getByRole("link");
  expect(link.getAttribute("href")).toBe("/listening/practice_a2_02");
  expect(screen.getByText("At the Library")).toBeDefined();
  expect(screen.getByText(/40 câu/)).toBeDefined();
  expect(screen.getByText(/8:20/)).toBeDefined();
});

test("bỏ thời lượng khi không có durationLabel", () => {
  render(
    <ListeningSetCard
      href="/listening/x"
      title="No duration"
      questionCount={10}
      linkComponent="a"
    />,
  );
  expect(screen.getByText("10 câu")).toBeDefined();
});
```

- [ ] **Step 4: Run it — must fail**

Run: `cd web && npm test -- src/components/ListeningSetCard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ListeningSetCard"`.

- [ ] **Step 5: Write `ListeningSetCard`**

Markup lifted verbatim from `web/src/app/(app)/listening/page.tsx:73-90` so the redesign starts from the current pixels.

`web/src/components/ListeningSetCard.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** One listening set in the hub list. Presentational: `linkComponent` is
 * injected (NextLink in the app, "a" in a design) — no default, because a
 * forgotten prop would silently cost client-side navigation. */
export function ListeningSetCard({
  href,
  title,
  questionCount,
  durationLabel,
  linkComponent: Link,
  className,
}: {
  href: string;
  title: string;
  questionCount: number;
  /** Pre-formatted, e.g. "8:20". Omit to hide. */
  durationLabel?: string;
  linkComponent: React.ElementType;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50",
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
        🎧
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-caption text-muted-foreground">
          {questionCount} câu{durationLabel ? ` · ${durationLabel}` : ""}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 6: Run it — must pass**

Run: `cd web && npm test -- src/components/ListeningSetCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Rewire the hub page to use them**

In `web/src/app/(app)/listening/page.tsx`: keep the Prisma query, `groups` derivation and `formatDuration` exactly as-is. Replace the inline badge span with `<LevelBadge level={group.level} />` and the whole inline `<Link>` block with:

```tsx
<ListeningSetCard
  key={set.slug}
  href={`/listening/${set.slug}`}
  title={set.title}
  questionCount={set.sections.reduce((n, s) => n + s._count.questions, 0)}
  durationLabel={set.durationSec ? formatDuration(set.durationSec) : undefined}
  linkComponent={NextLink}
/>
```

Add `import NextLink from "next/link";` and drop the now-unused `cn` import if nothing else uses it. The badge previously rendered only `{group.level}`; `LevelBadge` renders `B1 · Trung cấp`, so delete the adjacent `<h2>{LEVEL_META[group.level].labelVi}</h2>` to avoid printing the label twice.

- [ ] **Step 8: Verify nothing regressed**

```bash
cd web && npx tsc --noEmit -p tsconfig.json && npm test && npm run build
```
Expected: tsc exit 0 · 232 tests pass (229 + 3 new) · build exit 0.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/LevelBadge.tsx web/src/components/ListeningSetCard.tsx \
        web/src/components/ListeningSetCard.test.tsx "web/src/app/(app)/listening/page.tsx"
git commit -m "refactor(listening): extract LevelBadge + ListeningSetCard from the hub page

The hub's layout lived as inline markup, so the design system had no
listening card to build with. Both are presentational; linkComponent is
injected and required."
```

---

## Task 3: `EmptyState` — inject the link

**Files:**
- Modify: `web/src/components/EmptyState.tsx`, `web/src/app/(app)/listening/page.tsx`
- Test: `web/src/components/EmptyState.test.tsx`

**Interfaces:**
- Produces: `EmptyState({ icon?, title, description?, ctaHref?, ctaLabel?, linkComponent: React.ElementType })`

Check for other call sites before editing: `grep -rn "<EmptyState" web/src`. Every one must pass `linkComponent={NextLink}`.

- [ ] **Step 1: Write the failing test**

`web/src/components/EmptyState.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { EmptyState } from "@/components/EmptyState";

test("render tiêu đề và mô tả, không có CTA khi thiếu ctaHref", () => {
  render(<EmptyState title="Chưa có bài nghe nào" description="Quay lại sau nhé." linkComponent="a" />);
  expect(screen.getByText("Chưa có bài nghe nào")).toBeDefined();
  expect(screen.queryByRole("link")).toBeNull();
});

test("render CTA qua linkComponent khi có đủ ctaHref và ctaLabel", () => {
  render(
    <EmptyState title="Trống" ctaHref="/listening" ctaLabel="Luyện nghe" linkComponent="a" />,
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe("/listening");
});
```

- [ ] **Step 2: Run it — must fail**

Run: `cd web && npm test -- src/components/EmptyState.test.tsx`
Expected: FAIL — TypeScript/runtime error: `EmptyState` does not accept `linkComponent`, and the CTA still renders through `next/link` (which throws outside a router in jsdom).

- [ ] **Step 3: Edit `web/src/components/EmptyState.tsx`**

Delete `import Link from "next/link";`. Change the signature and CTA:

```tsx
export function EmptyState({
  icon = "🌱",
  title,
  description,
  ctaHref,
  ctaLabel,
  linkComponent: Link,
}: {
  icon?: string;
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
```

The body is unchanged; `<Link href={ctaHref} className={cn(buttonVariants(), "mt-2")}>` now resolves to the injected component.

- [ ] **Step 4: Run it — must pass**

Run: `cd web && npm test -- src/components/EmptyState.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Fix every call site**

`grep -rn "<EmptyState" web/src`. Known: `web/src/app/(app)/listening/page.tsx:53`. Add `linkComponent={NextLink}` to each.

- [ ] **Step 6: Prove the guard fires**

```bash
cd web
cat > src/__guard.tsx <<'EOF'
import { EmptyState } from "@/components/EmptyState";
export const A = () => <EmptyState title="x" />;
EOF
npx tsc --noEmit -p tsconfig.json 2>&1 | grep __guard
rm src/__guard.tsx
```
Expected: `error TS2741: Property 'linkComponent' is missing`. Then `npx tsc --noEmit` again → exit 0.

- [ ] **Step 7: Commit**

```bash
cd web && npx tsc --noEmit -p tsconfig.json && npm test && npm run build
git add web/src/components/EmptyState.tsx web/src/components/EmptyState.test.tsx "web/src/app/(app)/listening/page.tsx"
git commit -m "refactor(EmptyState): inject linkComponent instead of importing next/link"
```

---

## Task 4: `PlacementWizard` — inject navigation

**Files:**
- Modify: `web/src/components/PlacementWizard.tsx`, `web/src/app/onboarding/placement/page.tsx`
- Create: `web/src/components/PlacementWizardConnected.tsx`
- Test: `web/src/components/PlacementWizard.test.tsx`

**Interfaces:**
- Consumes: `SafeQuestion` from `web/src/components/runner/QuestionCard`.
- Produces:
  - `PlacementWizard({ listening, readingMd, readingSections, writingPromptMd, onFinished: () => void })`
  - `PlacementWizardConnected(props)` — same props minus `onFinished`.

`app/onboarding/placement/page.tsx` is a **server** component, so it cannot pass `onFinished`. Hence the wrapper — the same shape as `AppSidebarConnected`.

`PlacementWizard` also calls `fetch("/api/placement/submit-section")` and `fetch("/api/placement/complete")`. Leave those. They only fire on click, so the static preview renders correctly; interactive submit inside a design will fail, which Task 6 records in NOTES.md rather than papering over.

- [ ] **Step 1: Write the failing test**

The wizard opens on the listening step, which is exactly the surface being redesigned.

`web/src/components/PlacementWizard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { PlacementWizard } from "@/components/PlacementWizard";

const listening = {
  audioUrl: "/audio/placement.mp3",
  durationSec: 300,
  sections: [
    {
      label: "Section 1",
      title: "At the Library",
      instructions: "Nghe và chọn đáp án đúng.",
      questions: [
        {
          id: "q1",
          number: 1,
          prompt: "What time does the library close?",
          options: [
            { label: "A", text: "6 p.m." },
            { label: "B", text: "8 p.m." },
          ],
          kind: "MULTIPLE_CHOICE" as const,
          isOpenEnded: false,
        },
      ],
    },
  ],
};

test("mở ở bước Nghe và render câu hỏi listening", () => {
  render(
    <PlacementWizard
      listening={listening}
      readingMd="# Reading"
      readingSections={[]}
      writingPromptMd="Write 150 words."
      onFinished={vi.fn()}
    />,
  );
  expect(screen.getByText("Nghe")).toBeDefined();
  expect(screen.getByText(/What time does the library close/)).toBeDefined();
});

test("render được mà không cần router — không ném lỗi", () => {
  expect(() =>
    render(
      <PlacementWizard
        listening={null}
        readingMd="# Reading"
        readingSections={[]}
        writingPromptMd="Write 150 words."
        onFinished={vi.fn()}
      />,
    ),
  ).not.toThrow();
});
```

- [ ] **Step 2: Run it — must fail**

Run: `cd web && npm test -- src/components/PlacementWizard.test.tsx`
Expected: FAIL — `invariant expected app router to be mounted` (thrown by `useRouter()` outside Next). That error *is* the blocker this task removes.

- [ ] **Step 3: Edit `web/src/components/PlacementWizard.tsx`**

Delete `import { useRouter } from "next/navigation";` and the `const router = useRouter();` line. Add `onFinished` to the props object:

```tsx
export function PlacementWizard({
  listening,
  readingMd,
  readingSections,
  writingPromptMd,
  onFinished,
}: {
  listening: ListeningProp | null;
  readingMd: string;
  readingSections: ReadingSectionProp[];
  writingPromptMd: string;
  /** Called after `/api/placement/complete` succeeds. The app navigates to
   * `/onboarding/placement/result`; a design passes a no-op. Required. */
  onFinished: () => void;
}) {
```

At line ~212 replace `router.push("/onboarding/placement/result");` with `onFinished();`.

- [ ] **Step 4: Run it — must pass**

Run: `cd web && npm test -- src/components/PlacementWizard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the connected wrapper**

`web/src/components/PlacementWizardConnected.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

import { PlacementWizard } from "@/components/PlacementWizard";
import type { ComponentProps } from "react";

/** Router-aware wrapper. `useRouter()` needs Next's router context, which only
 * exists in the app — keeping it here is what lets PlacementWizard ship to the
 * design system and be unit-tested. */
export function PlacementWizardConnected(
  props: Omit<ComponentProps<typeof PlacementWizard>, "onFinished">,
) {
  const router = useRouter();
  return <PlacementWizard {...props} onFinished={() => router.push("/onboarding/placement/result")} />;
}
```

- [ ] **Step 6: Point the page at the wrapper**

In `web/src/app/onboarding/placement/page.tsx`: swap the import to `PlacementWizardConnected` and rename the JSX tag. Props are unchanged.

- [ ] **Step 7: Verify**

```bash
cd web && npx tsc --noEmit -p tsconfig.json && npm test && npm run build
```
Expected: tsc 0 · 236 tests pass · build 0.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/PlacementWizard.tsx web/src/components/PlacementWizardConnected.tsx \
        web/src/components/PlacementWizard.test.tsx web/src/app/onboarding/placement/page.tsx
git commit -m "refactor(placement): inject onFinished instead of calling useRouter

PlacementWizard could not be unit-tested or previewed because useRouter()
throws outside Next. The router now lives in PlacementWizardConnected."
```

---

## Task 5: Sync the four new components to Claude Design

**Files:**
- Modify: `web/.ds-entry.tsx`, `.design-sync/config.json`, `.design-sync/conventions.md`, `.design-sync/NOTES.md`
- Create: `.design-sync/previews/{EmptyState,LevelBadge,ListeningSetCard,PlacementWizard}.tsx`

**Interfaces:**
- Consumes: the props defined in Tasks 2–4.
- Produces: a 21-component design project; the 17 existing components must report `carried forward`.

- [ ] **Step 1: Re-stage the converter (it is gitignored)**

```bash
cd /home/ncd/learnspaces/learning_english
B=/tmp/claude-1000/bundled-skills/2.1.206/7dad62a8f81a9d341d6bb244e32950d6/design-sync
mkdir -p .ds-sync && cp -r "$B"/package-build.mjs "$B"/package-validate.mjs "$B"/package-capture.mjs "$B"/resync.mjs "$B"/lib "$B"/storybook .ds-sync/
echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
(cd .ds-sync && npm i esbuild ts-morph @types/react typescript && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright)
node .design-sync/fetch-fonts.mjs
```

- [ ] **Step 2: Export the four from `web/.ds-entry.tsx`**

```tsx
export { EmptyState } from "@/components/EmptyState";
export { LevelBadge } from "@/components/LevelBadge";
export { ListeningSetCard } from "@/components/ListeningSetCard";
export { PlacementWizard } from "@/components/PlacementWizard";
```

- [ ] **Step 3: Extend `.design-sync/config.json`**

Add to `componentSrcMap`: `EmptyState`, `LevelBadge`, `ListeningSetCard` → their `src/components/*.tsx` paths; `PlacementWizard` → `src/components/PlacementWizard.tsx`.

Add to `overrides`:

```json
"EmptyState":       { "cardMode": "column" },
"ListeningSetCard": { "cardMode": "column" },
"PlacementWizard":  { "cardMode": "single", "primaryStory": "ListeningStep", "viewport": "900x760" }
```

Add `dtsPropsFor` entries mirroring the signatures in Tasks 2–4 verbatim (ts-morph will otherwise flatten them; check the emitted `.d.ts` first and only override what degrades to `[key: string]: unknown`).

- [ ] **Step 4: Author the previews**

Each preview imports from `"web"` and passes `linkComponent="a"`. `PlacementWizard` opens on the listening step by default, so one export suffices:

`.design-sync/previews/PlacementWizard.tsx`:

```tsx
import { PlacementWizard } from "web";

const noop = () => {};
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA==";

export const ListeningStep = () => (
  <PlacementWizard
    listening={{
      audioUrl: SILENT_WAV,
      durationSec: 300,
      sections: [
        {
          label: "Section 1",
          title: "At the Library",
          instructions: "Nghe đoạn hội thoại và chọn đáp án đúng.",
          questions: [
            {
              id: "q1",
              number: 1,
              prompt: "What time does the library close on weekdays?",
              options: [
                { label: "A", text: "6 p.m." },
                { label: "B", text: "8 p.m." },
                { label: "C", text: "9 p.m." },
              ],
              kind: "MULTIPLE_CHOICE" as const,
              isOpenEnded: false,
            },
          ],
        },
      ],
    }}
    readingMd="## Passage 1"
    readingSections={[]}
    writingPromptMd="Viết 150 từ về chủ đề sau."
    onFinished={noop}
  />
);
```

`.design-sync/previews/ListeningSetCard.tsx` — three cells: with duration, without duration, long Vietnamese title. `LevelBadge.tsx` — one cell sweeping `A2 B1 B2 C1` (the variant axis must actually vary). `EmptyState.tsx` — two cells: with CTA, without.

- [ ] **Step 5: Build, validate, and LOOK at every sheet**

```bash
cd /home/ncd/learnspaces/learning_english
node .design-sync/build-css.mjs
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules web/node_modules --entry ./web/.ds-entry.tsx --out ./ds-bundle
DS_CHROMIUM_PATH=/usr/bin/google-chrome node .ds-sync/package-validate.mjs ./ds-bundle
DS_CHROMIUM_PATH=/usr/bin/google-chrome node .ds-sync/package-capture.mjs --out ./ds-bundle
```
Expected: `components: 21` · `render check: 21/21 previews render cleanly` · capture prints `17 carried forward, 4 captured`.

**Then Read every `ds-bundle/_screenshots/review/*__*.png` for the four new components.** The render check passes blank cards — `LectureToc` shipped empty because it is `hidden lg:block` and nothing flagged it. Grade each cell into `.design-sync/.cache/review/<Name>.grade.json` only after seeing its sheet.

- [ ] **Step 6: Assert the bundle stayed clean**

```bash
node -e 'const s=require("fs").readFileSync("ds-bundle/_ds_bundle.js","utf8");
for (const p of ["next-auth","useRouter","usePathname","next/link"]) console.log(p, s.includes(p) ? "LEAKED" : "ok");'
```
Expected: four `ok`. A leak means an extraction was incomplete.

- [ ] **Step 7: Update `conventions.md`, then rebuild via the driver**

Add the four components to the component list at the top of `.design-sync/conventions.md`, noting that `EmptyState` and `ListeningSetCard` need `linkComponent="a"`. Verify every class/name you write actually exists:

```bash
grep -cE '\.bg-success-bg[ ,{:]' ds-bundle/_ds_bundle.css   # must be ≥ 1
ls ds-bundle/components/*/                                   # names must match
```

Then — the header is stitched at build time, so a driver run is mandatory:

```bash
DS_CHROMIUM_PATH=/usr/bin/google-chrome node .ds-sync/resync.mjs \
  --config .design-sync/config.json --node-modules web/node_modules \
  --entry ./web/.ds-entry.tsx --out ./ds-bundle
```
Expected verdict JSON: `pendingGrade: []`, `learningsUnmerged: []`.

- [ ] **Step 8: Upload — sentinel, content, sentinel, anchor last**

Using the `DesignSync` tool against project `c65cc8d7-1c60-4c55-98e9-8c2555892ad3`. `finalize_plan` with `localDir: "./ds-bundle"` and the standard writes/deletes globs, then in order:
1. `write_files` `_ds_needs_recompile`
2. `write_files` the four `components/general/<Name>/` dirs, their `_preview/<Name>.js`, plus `_ds_bundle.js`, `_ds_bundle.css`, `styles.css`, `README.md`
3. `list_files` and delete any remote path the final `ds-bundle/` does not contain
4. `write_files` `_ds_needs_recompile` again
5. `write_files` `_ds_sync.json` **alone, last** — it is the anchor and must only vouch for a fully applied state

- [ ] **Step 9: Record and commit**

Append to `.design-sync/NOTES.md`: `PlacementWizard` keeps its two `fetch()` calls, so interactive submit inside a design fails (static render is correct); `ListeningSetCard`/`EmptyState` require `linkComponent`; `LevelBadge` reuses `LEVEL_META`, whose `import type { CefrLevel }` is erased so no Prisma reaches the bundle.

```bash
git add .design-sync web/.ds-entry.tsx
git commit -m "chore(design-sync): add EmptyState, LevelBadge, ListeningSetCard, PlacementWizard"
```

---

## Task 6: Design the two screens in Claude Design

This task is **driven by the user in the browser**, not by an agent. The deliverable is a chosen layout, not code.

- [ ] **Step 1: Open the project and confirm the new cards appear**

https://claude.ai/design/p/c65cc8d7-1c60-4c55-98e9-8c2555892ad3 — 21 components. Opening the project clears the `_ds_needs_recompile` sentinel and rebuilds the card index.

- [ ] **Step 2: Redesign the listening hub**

Prompt the design agent with, roughly: *"Thiết kế lại bố cục trang `/listening`. Dùng `AppSidebar` (pathname `/listening`, `linkComponent="a"`), `LevelBadge`, `ListeningSetCard`, `EmptyState`. Nhóm bài nghe theo cấp độ A2/B1/B2/C1. Khung trang: sidebar + `<main className="lg:pl-[232px]">`."*

- [ ] **Step 3: Redesign the listening set page**

*"Thiết kế lại `/listening/[slug]`. Dùng `AppSidebar` (`pathname="/listening"`, `linkComponent="a"`) + `<main className="lg:pl-[232px]">`. Trong main: tiêu đề bài nghe kèm `LevelBadge`, rồi `ListeningSetView`. Đừng thêm `AudioPlayer` — `ListeningSetView` đã có sẵn một cái bên trong."*

`ListeningSetView.tsx:79` renders its own sticky `<AudioPlayer variant="full">`. An
earlier draft of this prompt asked for an `AudioPlayer` *beside* it, and the design
agent duly produced two players. A direct instruction overrides the component's
`.prompt.md`, so the prompt must not contradict it.

- [ ] **Step 4: Redesign the placement listening step**

*"Thiết kế lại bước Nghe của bài kiểm tra đầu vào, dùng `PlacementWizard`. Không có sidebar — onboarding là luồng riêng."*

- [ ] **Step 5: Constraint to hand the agent**

The stylesheet is **static** — no Tailwind JIT at design time. Only the safelisted vocabulary resolves. `gap-7`, `w-[321px]`, `bg-blue-500` emit **no CSS**. If a layout looks broken, that is the first thing to check. The full vocabulary is in the project's `README.md` (the conventions header).

- [ ] **Step 6: Export the chosen layouts**

Save the generated JSX for each screen. It composes real DS components, so it maps onto `web/src` almost directly.

---

## Task 7: Port the designs back into the app

**Files:**
- Modify: `web/src/app/(app)/listening/page.tsx`, `web/src/app/(app)/listening/[slug]/page.tsx`, `web/src/components/PlacementWizard.tsx`

- [ ] **Step 1: Port one screen at a time, hub first**

Keep every server-side concern untouched — the Prisma queries, `getOrderedListeningSections`, the `safeSections` mapping that strips `answerRaw`/`variants` (answer keys must never reach the client). Change only JSX and class names.

Translate design-time props back to app props: `linkComponent="a"` → `linkComponent={NextLink}`.

- [ ] **Step 2: Run the existing tests — they must still pass unchanged**

Run: `cd web && npm test`
Expected: 236 pass. `ListeningSetCard.test.tsx` and `EmptyState.test.tsx` guard the components the new layout composes.

- [ ] **Step 3: Full verification**

```bash
cd web && npx tsc --noEmit -p tsconfig.json && npm run lint && npm run build
```
Expected: tsc 0 · lint unchanged (1 pre-existing `<img>` warning in `QuestionCard.tsx`) · build 0.

- [ ] **Step 4: Manual check — the one no tool catches**

`npm run dev`, log in, open DevTools → Network. Click a card on `/listening`. A **document** request means `linkComponent` was wired to `"a"` instead of `NextLink` and client-side navigation is dead. Only RSC/fetch requests is correct. Do the same from the sidebar.

Then walk the first-login flow: name → placement. The listening step must show the stepper on **Nghe**, the audio player, and the batch of questions.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(app)/listening" web/src/components/PlacementWizard.tsx
git commit -m "feat(listening): new hub, set page and placement listening layouts

Designed in claude.ai/design against the real component library, then
ported back. Server-side data loading and the answer-key stripping in
safeSections are unchanged."
```

---

## Verification

| Gate | Command | Expected |
|---|---|---|
| Types | `cd web && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Required-prop guard | temp file omitting `linkComponent`, then `tsc` | `TS2741` / `TS2739` |
| Unit tests | `cd web && npm test` | 236 pass (229 existing + 7 new) |
| Lint | `cd web && npm run lint` | 1 pre-existing warning, no new ones |
| Build | `cd web && npm run build` | exit 0 |
| DS render | `DS_CHROMIUM_PATH=/usr/bin/google-chrome node .ds-sync/package-validate.mjs ./ds-bundle` | `21/21 previews render cleanly` |
| DS purity | grep `_ds_bundle.js` for `next-auth`, `useRouter`, `usePathname`, `next/link` | all absent |
| DS carry-forward | `package-capture.mjs` | `17 carried forward` |
| Manual | click a card with DevTools open | no document request |

**What the automated gates cannot see** — do these by hand:
- Client-side navigation (a wrong `linkComponent` is valid HTML; build and tests stay green).
- A component that renders an **empty card** because it is viewport-gated (`hidden lg:block`). Read every review sheet.
- Dark mode. The render check only covers light. Toggle `.dark` on `<html>` and confirm tokens flip.

## Out of scope

- The 12 remaining feature components (`Flashcards`, `LessonMap`, `IeltsHub`, `ThemeToggleRow`, …). See `.design-sync/NOTES.md`.
- Splitting `web/src/lib/progress.ts` into pure types + queries (unlocks `LessonMap`, `PhasePillRow`, `IeltsHub`).
- Making `PlacementWizard`'s `fetch()` calls injectable. Static previews render correctly without it.
- Any change to lesson content, grading logic, or the seed scripts.
