# Section-Batched Listening Runner + Exercise Back-Navigation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** written 2026-07-11, approved, **not yet executed**. No code has been changed.

**Goal:** Rework the practice listening set page (`/listening/[slug]`) so each section shows *all* its questions at once with its own audio clip; submitting a section reveals wrong answers + correct answers and lets the learner continue immediately (no forced-correct); advancing swaps in the next section's audio + questions; and submitting a section unlocks that section's transcript. Separately, add read-only "previous question" navigation to the lesson exercise runner. The listening page's back control becomes a fixed, compact bottom nav.

**Architecture:** Audio is TTS-generated per line and concatenated into one `{slug}.mp3`; the transcript already carries `NARRATOR: Section N` split points. We teach the generator to also emit per-section `{slug}_s{n}.mp3` files, store each on a new nullable `Section.audioUrl`, and drive the player from the runner's current section (falling back to the set-level audio when a section has no clip — e.g. TOEIC "Part N" sets that don't split). The listening runner is rewritten as a **section-batched** component with its own small reducer; the shared forward-only `runnerReducer` stays untouched and keeps serving `ExerciseRunner`. Section submit calls the existing stateless per-question `check` route once per question in parallel — no new endpoint, no grading schema change. The exercise back-navigation is a client-only read-only review layered over the unchanged persisted forward flow.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma/Postgres · vitest 4 (+ jsdom UI harness) · Python edge-TTS + pydub · design-sync → claude.ai/design

**Design project:** https://claude.ai/design/p/c65cc8d7-1c60-4c55-98e9-8c2555892ad3

---

## Context

Today the practice listening runner (`web/src/components/ListeningRunner.tsx`) is a **one-question-at-a-time, forward-only, retry-until-correct** drill: it shares `runnerReducer` with the lesson `ExerciseRunner`, shows a single question, and forces a correct answer before advancing. Transcript unlock (`ListeningSetView.tsx`) is gated on that per-section completion. There is one audio file per set, played from a single `AudioPlayer` in the right rail.

The user wants a section-at-a-time model instead: see every question in the current section, submit the whole section, see which were wrong and the correct answers, then press **Tiếp tục** to move to the next section — where the audio becomes that section's clip and its questions appear. Not forced to get everything right. Submitting a section unlocks its transcript.

The user also reports the lesson exercise flow (`ExerciseRunner`) has no way to look back at a previous question; they want to review earlier questions read-only.

Finally, on the listening set page the "← Quay lại" link sits at the page foot (and a back affordance sat by the title); the user wants a single fixed, compact bottom navigation that stays visible while scrolling and is lowered from its current height.

**Decisions already made with the user:**
- Audio: **cut into 4 real files** — achieved by generating per-section clips from the transcript (not manual editing).
- Advance model: **submit section → reveal wrong + correct answers → Tiếp tục immediately**, not forced-correct.
- Transcript unlock: **on section submit** (answering the section, right or wrong, unlocks its transcript).

**Scope decisions this plan makes (open to veto at approval):**
- Applies to **PRACTICE listening sets** (`/listening/[slug]`) only. The onboarding placement wizard already batches per-section and is left unchanged.
- Section audio is **additive and optional**: a new nullable `Section.audioUrl`. When null, the runner falls back to the set-level `ListeningSet.audioUrl` and behaves as a single-audio sectioned run — so TOEIC/legacy sets that don't split keep working.
- Section submit is **final per section** (reveal answers, then continue) — no per-question retry inside a submitted section, matching "không ép sửa đúng hết". To redo, the learner uses a **"Làm lại từ đầu"** control that resets the *entire* set: clears every answer/result and **re-locks all transcripts**, back to a blank section 1.
- Exercise back-navigation is **read-only review** of already-answered questions; the persisted forward flow and lesson-unlock side effects are unchanged.

---

## Global Constraints

- **UI copy is Vietnamese.** English appears only inside lesson content (example sentences, listening/IELTS passages, vocabulary). Every new component, test fixture, and preview follows this.
- **Answer keys never reach the client** except as feedback *after* an answer is submitted. The listening `check` route already returns `correctAnswer` only for the submitted question; keep that boundary. Server components that pass questions to the client must keep stripping `answerRaw`/`variants` (the `safeSections` pattern in `web/src/app/(app)/listening/[slug]/page.tsx`).
- **Semantic tokens only** — `bg-card`, `text-muted-foreground`, `bg-success-bg`/`text-success`, `bg-destructive-bg`/`text-destructive`, `bg-streak-bg`/`text-streak-foreground`, the DS type scale `text-h1/h2/body/caption`. Never a hex or raw `oklch()`. Dark mode must keep working.
- **Do not modify the shared `runnerReducer`'s existing behaviour** (`web/src/components/runner/reducer.ts`) — `ExerciseRunner` depends on it and `reducer.test.ts` pins it. The new listening runner gets its own reducer. The exercise back-navigation adds *component-level* review state, not a change to the forward reducer's transitions.
- **`linkComponent` injection stays required-with-no-default** wherever a design-synced component takes it (established pattern; a default `"a"` silently kills client-side navigation).
- **Design-sync build order is mandatory** for any DS work: `node .design-sync/build-css.mjs` → converter. `cfg.cssEntry` is copied verbatim. Browser commands need `DS_CHROMIUM_PATH=/usr/bin/google-chrome`. `.design-sync/conventions.md` and the `@source inline(...)` safelist in `build-css.mjs` must stay in sync. See `.design-sync/NOTES.md`.
- **Re-running TTS hits the network** (edge-tts) and regenerates audio; the **user** runs `generate_audio.py`, not the agent. Section audio must degrade gracefully until regenerated.
- Work happens directly on `main`. Commit after each task. After schema changes, a Prisma migration is created and applied.

---

## File Structure

**Create**
- `web/src/components/SectionedListeningRunner.tsx` — the section-batched runner (all questions in the current section, one submit, reveal, continue).
- `web/src/components/runner/section-runner.ts` — a small dedicated reducer + pure helpers for the section-batched flow (separate from the shared `reducer.ts`).
- `web/src/components/runner/section-runner.test.ts` — reducer/helper tests.
- `web/src/components/SectionedListeningRunner.test.tsx`, `web/src/components/ListeningSetView.test.tsx` — UI tests (jsdom harness already installed).
- `web/src/components/ExerciseReview.test.tsx` (or extend an existing exercise test) — read-only back-navigation.
- `.design-sync/previews/SectionedListeningRunner.tsx`, `.design-sync/previews/ListeningBottomNav.tsx` — DS previews.

**Modify**
- `web/prisma/schema.prisma` — add `Section.audioUrl String?`.
- `web/prisma/migrations/**` — the generated migration.
- `web/scripts/tts/generate_audio.py` — also emit per-section `{slug}_s{n}.mp3`.
- `web/scripts/seed/ingest.ts` — set `Section.audioUrl` from the per-section files when present.
- `web/scripts/seed/check-listening.ts` — (optional) note/verify per-section audio presence.
- `web/src/components/ListeningSetView.tsx` — lift "current section" state; drive the right-rail `AudioPlayer` from the current section's audio; render `SectionedListeningRunner` instead of `ListeningRunner`; keep the per-section transcript rail, unlocking on submit.
- `web/src/app/(app)/listening/[slug]/page.tsx` — pass `audioUrl` per section into `safeSections`; move the back control into the new fixed bottom nav; remove the foot "← Quay lại".
- `web/src/components/ExerciseRunner.tsx` — add read-only previous-question review.
- `web/.ds-entry.tsx`, `.design-sync/config.json`, `.design-sync/conventions.md`, `.design-sync/NOTES.md` — sync the new components.

**Leave unchanged**
- `web/src/components/runner/reducer.ts` and `reducer.test.ts` (shared, still used by `ExerciseRunner`).
- `web/src/app/api/listening/[slug]/check/route.ts` (reused per-question, unchanged).
- `web/src/components/PlacementWizard.tsx` (placement listening step out of scope).
- `web/src/components/ListeningRunner.tsx` stays until Task 5 swaps it out, then is removed.

---

## Task 1: `Section.audioUrl` schema + migration

**Files:** `web/prisma/schema.prisma`, `web/prisma/migrations/**`

**Interfaces:** Produces a nullable `Section.audioUrl` column; downstream tasks read/write it.

- [ ] **Step 1:** Add `audioUrl String?` to `model Section` in `schema.prisma`, with a comment: per-section listening clip; null → fall back to `ListeningSet.audioUrl`.
- [ ] **Step 2:** `cd web && npx dotenv -e .env.local -- npx prisma migrate dev --name section_audio_url`. Expected: one `ALTER TABLE "Section" ADD COLUMN "audioUrl" TEXT;`, applied clean, client regenerated.
- [ ] **Step 3:** `npx prisma migrate status` → up to date. Commit schema + migration.

---

## Task 2: Per-section TTS generation + seed wiring

**Files:** `web/scripts/tts/generate_audio.py`, `web/scripts/seed/ingest.ts`, `web/scripts/seed/check-listening.ts`

**Interfaces:**
- Consumes: the `^NARRATOR:\s*Section\s+(\d+)\b` marker rule (already in `web/src/lib/transcript.ts` `SECTION_MARKER_RE`; mirror it on the Python side).
- Produces: `web/public/audio/listening/{slug}_s{n}.mp3` (one per section, in addition to the whole-set `{slug}.mp3`), and `Section.audioUrl` populated by the seed when those files exist.

- [ ] **Step 1:** In `generate_audio.py`, group the parsed `(speaker, text)` lines into sections by the section-marker regex (preamble before marker 1 joins section 1, matching `transcriptChunksForSections`). Export each section group to `{slug}_s{n}.mp3` **in addition to** the existing combined `{slug}.mp3` (keep the combined file — it is the fallback and the placement/legacy path). Only split when markers are present and number cleanly `1..N`; otherwise emit just the combined file and log that it was not split.
- [ ] **Step 2:** Extend the `--dry-run` printout to show the per-section split counts, so the user can preview before spending TTS calls.
- [ ] **Step 3:** In `ingest.ts` `seedListeningSets`, after creating each `Section`, set `audioUrl = /audio/listening/{slug}_s{n}.mp3` **iff that file exists on disk** (mirror the existing `mp3Path` existence check at ingest.ts:92-98); else leave null. Order sections so `n` matches their appearance.
- [ ] **Step 4:** (Optional) In `check-listening.ts`, warn (not error) when a PRACTICE set's transcript splits into N sections but fewer than N `{slug}_s{n}.mp3` files exist — a nudge to re-run TTS.
- [ ] **Step 5:** Verify without the network: `python3 web/scripts/tts/generate_audio.py web/content/listening/practice_a2_01.md --dry-run` prints 4 section groups. Then, if the user has run TTS, `ls web/public/audio/listening/practice_a2_01_s*.mp3` shows 4 files; re-seed and confirm `Section.audioUrl` is set (a short Prisma probe). Commit.

**Note for the executor:** actually generating audio requires the edge-tts network and `web/scripts/tts/.venv`; that run is the **user's**. The code path must be correct and must degrade to the combined file when per-section files are absent.

---

## Task 3: The section-batched reducer + helpers (pure, TDD)

**Files:** `web/src/components/runner/section-runner.ts`, `web/src/components/runner/section-runner.test.ts`

**Interfaces:**
- Produces:
  - `SectionRunnerState { sectionIndex: number; phase: "answering" | "checking" | "submitted"; answers: Record<questionId, string>; results: Record<questionId, AnswerResult> | null; submittedSections: number }`
  - actions: `SET_ANSWER(questionId, value)`, `SUBMIT_SECTION`, `SECTION_RESULT(results)`, `CONTINUE` (→ next section, or `finished`).
  - helpers: `isSectionComplete(section, answers)` (all questions have non-empty input), `sectionScore(section, results)`.
- Reuses the `AnswerResult` type from `web/src/components/runner/reducer.ts` (import the type only).

- [ ] **Step 1:** Write `section-runner.test.ts` first: answering fills `answers`; `SUBMIT_SECTION` only fires when every question in the section has input and moves to `checking`; `SECTION_RESULT` stores results and moves to `submitted`; `CONTINUE` from `submitted` advances `sectionIndex`, bumps `submittedSections`, clears per-question state, and goes to `finished` after the last section. Assert `submittedSections` increments exactly once per section (drives transcript unlock).
- [ ] **Step 2:** Run — must fail (module missing).
- [ ] **Step 3:** Implement `section-runner.ts` minimally to pass.
- [ ] **Step 4:** Run — green. Commit.

---

## Task 4: `SectionedListeningRunner` component (TDD, jsdom)

**Files:** `web/src/components/SectionedListeningRunner.tsx`, `web/src/components/SectionedListeningRunner.test.tsx`

**Interfaces:**
- Consumes: `SafeListeningSection[]` (the type currently exported from `ListeningRunner.tsx`; move it to `section-runner.ts`), the `section-runner` reducer, `QuestionCard`, `ExplanationSlot`, the stateless `POST /api/listening/[slug]/check`.
- Produces: `SectionedListeningRunner({ slug, sections, currentSection, onSectionChange, onSectionSubmitted, onReset })` where `onSectionChange(i)` lets the parent swap the audio, `onSectionSubmitted(i)` unlocks the transcript, and `onReset()` tells the parent to re-lock all transcripts.

- [ ] **Step 1:** Failing test: renders **all** questions of the current section at once (assert N `QuestionCard`s), a single "Kiểm tra"/"Nộp phần" button, disabled until every question in the section has an answer.
- [ ] **Step 2:** Failing test: on submit, calls `/check` once per question (mock `fetch`, assert call count = section question count, in parallel), then shows each question's correct/incorrect state + the correct answer for wrong ones, and a "Tiếp tục" button. No forced-correct: "Tiếp tục" is enabled regardless of score.
- [ ] **Step 3:** Failing test: "Tiếp tục" fires `onSectionSubmitted(i)` (once) and `onSectionChange(i+1)`, advances to the next section's questions; after the last section shows the completion state.
- [ ] **Step 4:** Failing test: a **"Làm lại từ đầu"** control resets to a blank section 1 (no answers, no revealed results) and fires an `onReset` callback (so the parent can re-lock transcripts). Simplest impl: a `resetKey` state bumped on reset that remounts the inner runner via React `key` (same trick as `ExerciseRunner`), plus `onReset()`.
- [ ] **Step 5:** Implement `SectionedListeningRunner.tsx`: batch submit via `Promise.all` over the existing per-question endpoint; reveal inline using the same success/destructive token treatment as `ExerciseRunner`; keep the `SectionStepper` (lift from `ListeningRunner.tsx`) display-only; wire the reset.
- [ ] **Step 6:** Run all four green. `npx tsc --noEmit`. Commit.

---

## Task 5: Wire `ListeningSetView` to per-section audio + the new runner

**Files:** `web/src/components/ListeningSetView.tsx`, `web/src/components/ListeningSetView.test.tsx`, `web/src/app/(app)/listening/[slug]/page.tsx`

**Interfaces:**
- Consumes: `SectionedListeningRunner`, per-section `audioUrl` on each `SafeListeningSection`.
- Produces: the set page renders per-section audio in the right rail, driven by the runner's current section; transcript rail unlocks a section on submit.

- [ ] **Step 1:** Extend the server `safeSections` mapping in `page.tsx` to include each section's `audioUrl` (still stripping `answerRaw`/`variants`). Add `audioUrl` to `SafeListeningSection`.
- [ ] **Step 2:** In `ListeningSetView`, lift `currentSection` and `submittedSections` state. Right-rail `AudioPlayer` `src = sections[currentSection].audioUrl ?? audioUrl` (fallback to the set-level file). Render `SectionedListeningRunner` with `currentSection`, `onSectionChange={setCurrentSection}`, `onSectionSubmitted` → the existing per-section transcript-unlock state, and `onReset` → clear that state (re-lock every transcript) and reset `currentSection` to 0.
- [ ] **Step 3:** Failing test: rendering with two sections whose `audioUrl` differ, then advancing, updates the audio `src`; submitting section 1 unlocks its transcript chunk; **"Làm lại từ đầu" re-locks it** and returns to section 1's audio. (jsdom: assert the `<audio src>` attribute and transcript text visibility before/after reset.)
- [ ] **Step 4:** Delete `ListeningRunner.tsx` (now unused) and any now-dead exports. `grep -rn "ListeningRunner" web/src` → only the sectioned one remains.
- [ ] **Step 5:** `npx tsc --noEmit && npm test && npm run build`. Commit.

---

## Task 6: Fixed compact bottom nav on the listening set page

**Files:** `web/src/app/(app)/listening/[slug]/page.tsx`, `web/src/components/ListeningSetView.tsx` (+ a small `ListeningBottomNav` if it earns its own file), design in claude.ai/design

**Interfaces:** Produces a fixed, always-visible, compact bottom bar carrying the "← Quay lại danh sách bài nghe" control (and optionally section position), lowered from the current placement; the foot link and the by-title back affordance are removed.

- [ ] **Step 1:** Design the bar in Claude Design against the real components (sync in Task 7). Prompt sketch: *"Thanh điều hướng dưới cố định (`fixed inset-x-0 bottom-0`), gọn, nền `bg-card` + `border-t`, trong khung `lg:pl-[232px]` để không đè sidebar; bên trái nút quay lại danh sách bài nghe."* Constraint: static stylesheet — only safelisted utilities resolve.
- [ ] **Step 2:** Implement as a `fixed inset-x-0 bottom-0` element inside the app frame, `lg:pl-[232px]` so it clears the sidebar, compact height, `bg-card`/`border-border`. Add matching bottom padding to the scroll container so content isn't hidden behind it. Remove the foot "← Quay lại" and the by-title back link.
- [ ] **Step 3:** Manual check (dev): the bar stays put while scrolling a long set, sits low, doesn't cover the last question, and clears the sidebar at ≥1024px. `npm run build`. Commit.

---

## Task 7: Sync the new listening components to Claude Design

**Files:** `web/.ds-entry.tsx`, `.design-sync/config.json`, `.design-sync/conventions.md`, `.design-sync/NOTES.md`, `.design-sync/previews/*`

Follow the established re-sync flow (see `.design-sync/NOTES.md`): stage the converter, `build-css.mjs`, `package-build.mjs`, `package-validate.mjs`, `package-capture.mjs`, **read the review PNGs for the new components**, assert bundle purity (`next-auth`/`useRouter`/`usePathname`/`next/link` absent), update `conventions.md` + safelist together, then upload sentinel → content → sentinel → `_ds_sync.json` last.

- [ ] **Step 1:** Export `SectionedListeningRunner` (and `ListeningBottomNav` if split out) from `web/.ds-entry.tsx`; add to `componentSrcMap` + `overrides` (page-width → `cardMode: "column"`, tall viewport for the runner).
- [ ] **Step 2:** Author previews with a 2-section fixture (per-section audio via a silent-wav data URI), `linkComponent="a"` where needed.
- [ ] **Step 3:** Build + validate + capture; **read every new review sheet** (the render check passes blank/viewport-gated cards — look).
- [ ] **Step 4:** Bundle-purity grep clean; `conventions.md`/safelist in sync; driver run verdict `pendingGrade: []`.
- [ ] **Step 5:** Upload to project `c65cc8d7-…` in the fenced order. Record notes; commit `.design-sync` + `.ds-entry.tsx`.

---

## Task 8: Read-only previous-question review in `ExerciseRunner`

**Files:** `web/src/components/ExerciseRunner.tsx`, `web/src/components/ExerciseReview.test.tsx`

**Interfaces:** Produces a "← Câu trước" control that shows a previously-answered question read-only (the learner's submitted answer + the correct answer/keyNote already returned), with a way to return to the live question. Forward flow, `POST /api/attempts/[attemptId]/answers`, `tries`, and lesson-unlock are unchanged.

- [ ] **Step 1:** Failing test: after answering question 1 correctly and advancing to question 2, a "← Câu trước" control is present; activating it renders question 1 **read-only** (inputs disabled, the submitted answer and correct answer shown) and does **not** POST anything.
- [ ] **Step 2:** Failing test: from review, returning restores the live current question at the same phase; the primary submit/continue button is hidden while reviewing.
- [ ] **Step 3:** Implement with component-level state only: keep an append-only array of past `{ questionIndex, answerText, result }` captured on each `RESULT`/`CONTINUE`, plus a `reviewIndex: number | null`. When `reviewIndex` is set, render that past question read-only from the captured data; hide the forward action; show back/forward + "Quay lại câu hiện tại". Do not touch `runnerReducer`.
- [ ] **Step 4:** Run green. `npx tsc --noEmit && npm test`. Commit.
- [ ] **Step 5:** (Optional) design the review affordance in Claude Design and sync `ExerciseRunner` — only if the visual treatment needs it; otherwise ship the app change and note it.

---

## Verification

| Gate | Command | Expected |
|---|---|---|
| Types | `cd web && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Unit + UI tests | `cd web && npm test` | all pass (existing + section-runner, sectioned-runner, set-view, exercise-review) |
| Lint | `cd web && npm run lint` | no new warnings (1 pre-existing `<img>` in QuestionCard) |
| Build | `cd web && npm run build` | exit 0 |
| Migration | `cd web && npx prisma migrate status` | up to date |
| TTS split (no network) | `python3 web/scripts/tts/generate_audio.py web/content/listening/practice_a2_01.md --dry-run` | prints 4 section groups |
| DS render | `DS_CHROMIUM_PATH=/usr/bin/google-chrome node .ds-sync/package-validate.mjs ./ds-bundle` | all previews render cleanly |
| DS purity | grep `_ds_bundle.js` for `next-auth`/`useRouter`/`usePathname`/`next/link` | all absent |

**Manual, end-to-end (the parts no tool catches — run `npm run dev`):**
- Open a practice set. Section 1 shows **all** its questions and section 1's audio. Answer some right, some wrong, submit → wrong ones marked with the correct answer, **Tiếp tục** enabled regardless. Continue → audio switches to section 2's clip, section 2's questions appear, section 1's transcript is now unlocked. Finish all sections → completion + full transcript.
- Audio fallback: a set with no per-section files still plays the single combined audio and advances sections without error.
- Bottom nav stays fixed and low while scrolling a long set, clears the sidebar at ≥1024px, and never covers the last question.
- Lesson exercise: answer a couple of questions, use "← Câu trước" to review an earlier one read-only (no network call, inputs disabled), return to the live question and continue — lesson-unlock still fires on completion.
- Dark mode: toggle `.dark`; success/destructive/streak surfaces and the bottom bar all flip.

## Out of scope

- The onboarding placement wizard's listening step (already section-batched; unchanged).
- Persisting listening attempts server-side (the `check` route stays stateless; no `ExerciseAttempt` for listening).
- Per-question retry *inside* a submitted section (submit is final per section by decision).
- Regenerating the actual audio for every set — that TTS run is the user's to perform; the code degrades gracefully until then.
- Any change to grading logic (`matchAnswer`) or answer-key content.
