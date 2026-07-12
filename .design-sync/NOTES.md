# design-sync notes — Học tiếng Anh

Repo-specific gotchas. Read this before any re-sync.

## Shape

- This repo is **not a design-system package**. `web/` is a Next.js 15 app. There is no
  `dist/`, no library entry, no Storybook. `shape: "package"` with `--entry ./web/.ds-entry.tsx`
  — a barrel that re-exports the six real primitives from `web/src/components/ui`. It
  reimplements nothing.
- **All 38 app components are synced** (pinned via `componentSrcMap`). The only files in
  `web/src/components/` NOT synced are the seven `*Connected.tsx` wrappers — see
  "What is synced" below.
- Compound parts (`CardHeader`, `TabsTrigger`, …) ship in the bundle for composition but are
  not registered as components.

## Build order (mandatory)

```sh
node .design-sync/fetch-fonts.mjs    # 1. vendor woff2  -> web/.ds-css/fonts/
node .design-sync/build-css.mjs      # 2. compile CSS   -> web/.ds-css/styles.compiled.css
node .ds-sync/resync.mjs …           # 3. converter
```

- **`cfg.cssEntry` is copied verbatim — the converter never runs Tailwind.** Pointing it at
  `src/app/globals.css` would ship `@import "tailwindcss"` and every preview renders unstyled.
- **Fonts come from `next/font/google`**, so no font files exist in the repo. Without
  `fetch-fonts.mjs` every design silently falls back to a system font. The `vietnamese`
  subset is required — all UI copy is Vietnamese.
- Both output dirs (`web/.ds-css/`) are gitignored; re-run both scripts on a fresh clone.

## Tailwind v4 tree-shaking — the sharp edge

Designs receive only the **pre-compiled** `styles.css`; there is no JIT at design time.
Tailwind emits only utilities it can *see*. Therefore `build-css.mjs` carries:

- `@source` for `web/src/components/ui` (classes live inside `cva()` strings) and for
  `.design-sync/previews` (preview layout glue).
- An `@source inline(...)` **safelist** of the layout/typography/semantic-color vocabulary
  the design agent is allowed to use. `.design-sync/conventions.md` documents exactly that
  vocabulary. **The safelist and the conventions header must stay in sync** — a class in the
  header but not the safelist produces no CSS; a class in the safelist but not the header is
  never used.
- The DS has its **own type scale** from `@theme --text-*`: `text-h1`, `text-h2`, `text-body`,
  `text-caption` (tuned line-height + letter-spacing). It is safelisted and documented. Don't
  let the agent fall back to `text-2xl` for headings.
- **`web/.ds-css/` MUST stay gitignored.** Tailwind v4's automatic source detection honours
  `.gitignore`; if the output dir is ever tracked, Tailwind scans its own previous
  `styles.compiled.css`, harvests junk class-like tokens out of it (font filenames, `oklch`
  strings) and the stylesheet grows ~11 KB of garbage per run. Symptom: CSS size changes on a
  no-op rebuild. Verify determinism by running `build-css.mjs` twice and comparing sizes.

## Environment

- `package-validate.mjs` / `package-capture.mjs` need `DS_CHROMIUM_PATH=/usr/bin/google-chrome`.
  Playwright's browser download was skipped (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright`
  inside `.ds-sync/`) — the system Chrome is used instead.
- **`(.d.ts parse check skipped — typescript not in node_modules)` is a false message.**
  `typescript` IS installed in `.ds-sync/`; `import('typescript')` resolves but exposes no
  named ESM exports, so `ts.createSourceFile` is `undefined`, the call throws, and validate's
  `catch` misreports it as "not installed". The `.d.ts` files were instead verified with
  `tsc --noEmit` directly (all six clean). Don't chase this line.
- Creating the Design project via the **API returned 403 `subscription required`**; creating it
  in the claude.ai/design **web UI worked**, then a fresh `/design-login` let the API adopt it.
  If a future sync must create a project, expect to do it in the UI first.

## dtsPropsFor

Props are typed through `@base-ui/react` namespaces (`ButtonPrimitive.Props`,
`SwitchPrimitive.Root.Props`, `TabsPrimitive.Root.Props`). ts-morph flattens these to
`[key: string]: unknown`, which would leave the design agent with no API contract at all.
All six therefore use hand-written `cfg.dtsPropsFor` bodies, checked against the real
`@base-ui/react` `.d.ts` files (`checked` / `defaultChecked` / `onCheckedChange`;
`value` / `defaultValue` / `onValueChange` / `orientation`).

## Known render warns

- None outstanding. `[GRID_OVERFLOW]` was real for `Tabs` and for most feature components
  (they are page-width by nature); all are fixed with `cfg.overrides.<Name>.cardMode = "column"`.

## Traps the render check does NOT catch (found the hard way)

- **`⚠` as legitimate content is misread as a caught error.** `package-validate.mjs` treats a
  cell whose text starts with `⚠` as a render error (`if (t.startsWith('⚠')) caught++`).
  `AnswerKeyAccordion`'s `<summary>` legitimately opens with "⚠️ Đáp án & giải thích", so its
  card reported `bad: 2` with **zero** actual pageerrors. The preview leads with a caption line
  so the cell text no longer starts with `⚠`. Don't "fix" this by skipping the component.
  **`ErrorState` hit the exact same trap** (its icon tile *is* a ⚠️) and is fixed the same way —
  a caption line above the component in every story.
- **`hidden lg:block` components render as an empty card and still pass the render check.**
  `LectureToc` is a desktop-only aside; at the default card viewport it is `display:none`, the
  root is non-empty, and nothing flags it. Fixed with
  `cfg.overrides.LectureToc.viewport = "1180x360"`. **Always look at the review sheets** — this
  class of failure is invisible to every automated check.
- **`QuestionCard` graded states cannot be shown on a multiple-choice question.** The selected
  option lives in an internal `useState` with no prop to seed it, so a static graded MCQ renders
  as plain-disabled. The `Correct`/`Incorrect` cells therefore use `FILL_BLANK`, where `status`
  colours the input directly.
- **`AnswerKeyAccordion` has no open state in previews** — it is a native `<details>` with no
  `open` prop. Every static render is the closed summary bar.
- **`cfg.overrides.*.viewport` changes require a full `package-build.mjs`**, not
  `preview-rebuild.mjs` (which exits `[CONFIG_STALE]`). `cardMode` alone is fine in the
  targeted loop.

## Feature components — what is synced, what is not

**Synced (9, no app changes needed).** `AnswerKeyAccordion`, `GoalPicker`, `ExplanationSlot`,
`AudioPlayer`, `LectureToc`, `MarkdownContent`, `QuestionCard`, `SectionedListeningRunner`,
`ListeningSetView`. They depend only on `cn` and pure helpers. `lucide-react` and
`react-markdown` are ordinary imports and esbuild inlines them (bundle ≈ 0.75 MB, 80 inlined
externals) — no `cfg.extraEntries` needed. Group comes from the src path, so the two under
`src/components/runner/` land in a `runner` group.

**App shell — synced (2), and it required app changes.** `AppHeader` and `AppSidebar` were
extracted: `linkComponent` (required, no default) replaces `next/link`; `logoutSlot: ReactNode`
replaces the `LogoutButton`/`next-auth` import; `pathname: string` replaces `usePathname()`.
`AppSidebarConnected` ("use client") keeps the router in the app. `layout.tsx` is a **server**
component, which is why logout is a ReactNode slot and not an `onLogout` callback — you cannot
pass a function from a server component. Full write-up: `docs/design/APP_SHELL_EXTRACTION.md`.

`linkComponent` intentionally has **no default**. A default of `"a"` would let a forgotten prop
silently downgrade every link to a full page load — green build, green tests, no error. Verified
the guard fires by compiling a deliberate omission (TS2739).

**Presentational feature components — synced (4, Task 5).** `EmptyState`, `LevelBadge`,
`ListeningSetCard`, `PlacementWizard` were extracted in Tasks 2–4 and added to the bundle
(21 components total).

- `EmptyState` and `ListeningSetCard` take a **required** `linkComponent` (no default, same
  rationale as `AppHeader`) — previews pass `linkComponent="a"`.
- `LevelBadge` reuses `LEVEL_META` from `src/lib/listening-ui.ts`, whose
  `import type { CefrLevel } from "@prisma/client"` is **type-only and erased at compile**, so
  no Prisma reaches the bundle (verified: the purity grep finds no `next-auth`/`useRouter`/
  `usePathname`/`next/link`). Its per-level `badgeClass` strings live in that lib file, outside
  the `@source "../src/components"` scan, so `build-css.mjs` gained a targeted
  `@source "../src/lib/listening-ui.ts"` — without it `bg-primary/10`, `bg-accent/15`,
  `text-accent`, `bg-destructive/10` emit no CSS and the pills render unstyled.
- `PlacementWizard` **retains its two `fetch()` calls** (`/api/placement/submit-section` and
  `/api/placement/complete`). They fire only on submit, so the static preview renders correctly,
  but **interactive submit inside a design will fail** — this is a known limitation, not a bug.
  It needs a tall viewport (`900x760`, `cardMode: single`, `primaryStory: ListeningStep`).
- All four flattened to `[key: string]: unknown` from ts-morph (plain inline prop types still
  degraded), so all four have hand-written `cfg.dtsPropsFor` bodies; the emitted `.d.ts`
  typecheck clean under `tsc --noEmit`.

**The remaining 17 — synced in Task 0.5. Nothing is out of scope any more.**
`ErrorState`, `ExerciseRunner`, `IeltsHub`, `InlineExample`, `LessonMap`, `LessonNode`
(`lesson-node.tsx`), `LessonTabs`, `ListeningBottomNav`, `PhasePillRow`, `Flashcards`,
`MatchGame`, `QuizGame`, `LogoutButton`, `ResetToStartButton`, `SettingsGoalForm`,
`SettingsNameEditor`, `ThemeToggleRow` — **38 components total.**

- The `next/link` blocker was cleared by injection, not by stubbing: every one of these takes a
  required `linkComponent` (Task 0.2), exactly like `AppHeader`.
- The router/session/theme blocker was cleared by the Task 0.3 split: each container is now a
  presentational component + a thin `*Connected.tsx` wrapper that owns the effect.
- **The "Prisma blocker" for `IeltsHub`/`LessonMap`/`PhasePillRow` never existed.** Their
  `import type { LessonState } from "@/lib/progress"` / `import type { IeltsSkill }` are
  **type-only and erased at compile** — no Prisma value ever reaches the bundle. (Verified by the
  purity grep and by the clean bundle build. Same story as `LevelBadge`.) `@/lib/progress` was
  therefore never split, and does not need to be.

**Deliberately NOT synced: the seven `*Connected.tsx` wrappers** — `AppSidebarConnected`,
`LogoutButtonConnected`, `PlacementWizardConnected`, `ResetToStartButtonConnected`,
`SettingsGoalFormConnected`, `SettingsNameEditorConnected`, `ThemeToggleRowConnected`. They exist
precisely to keep `next-auth` / `next-themes` / `next/navigation` / `next/link` out of the design
bundle; syncing them would drag the framework back in. They are the ONLY files under
`web/src/components/` that import any of those four.

**States that cannot be previewed statically** (the preview files say so in-line; design these
from the tokens, not from a card):

- `ExerciseRunner` graded/finished/review — `phase` lives in an internal reducer and only moves
  after `POST /api/attempts/:id/answers`. Use `QuestionCard`'s own `Correct`/`Incorrect` cells.
- `InlineExample` correct/wrong/revealed — status only changes after the server check (the answer
  is deliberately never shipped to the client).
- `Flashcards` flipped face, `MatchGame` / `QuizGame` selected-matched-wrong tiles and their
  finish screens — all internal `useState` with no seeding prop. (`Flashcards` with `words={[]}`
  does render the finish screen, which is how its `Finished` cell exists.)
- The vocab games shuffle their rounds in a `useEffect` (hydration safety), so their cards differ
  between renders. That is expected; do not "fix" it.
- `ListeningBottomNav` is `fixed inset-x-0 bottom-0`: it escaped its preview cell and tripped
  `[GRID_OVERFLOW]`. Fixed with `cardMode: "single"` **plus** a `transform`ed wrapper in the
  preview (a transform creates a containing block for `fixed`). That wrapper is a preview device
  only.

**Every one of the 17 has a hand-written `cfg.dtsPropsFor`** — ts-morph flattens plain inline prop
types to `[key: string]: unknown`, which would leave the design agent with no API contract.

**The test suite does not protect the UI layer.** `vitest.config.ts` is `include: src/**/*.test.ts`
(no `.tsx`) and `environment: "node"`. All 229 tests are pure logic. Green tests say nothing about
`AppHeader`/`AppSidebar`. The real safety nets are `npx tsc --noEmit`, `npm run build`, and
clicking a nav link with DevTools open (a document request = client-side navigation is broken).

**Never stub** `next/navigation`, `next-auth`, or `next-themes` to make a preview render — the
card would then show a component that does not exist in the app, and the design agent would
reproduce that fiction in every design it builds.

## Re-sync risks

- **Font vendoring hits the network** (Google Fonts). Offline re-syncs will fail at step 1;
  the woff2 files are gitignored, not committed.
- **The safelist can rot.** If `web/src/app/globals.css` gains new semantic tokens (e.g. a new
  `--warning`), neither the safelist nor `conventions.md` learns about it automatically.
  Re-check both when tokens change.
- **`dtsPropsFor` is hand-written** and will drift if `@base-ui/react` changes its prop names.
  Re-verify against `web/node_modules/@base-ui/react/*/root/*.d.ts` on a major bump.
- `web/.ds-entry.tsx` must be kept in step with `web/src/components/ui/` — a new primitive
  needs a line there **and** an entry in `componentSrcMap`.
- Dark mode was verified by rendering with `.dark` on `<html>` and confirming tokens flip
  (`--background` `oklch(0.985 …)` → `oklch(0.2 …)`), not by the render check, which only
  covers light.
