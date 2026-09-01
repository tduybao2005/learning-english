# Vocabulary by Topic + Game/Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. TDD applies to every code task — write the failing test first.

**Goal:** Re-axis the vocabulary experience from *lesson-based* to *topic-based* (37 real-world topics spanning everyday life, IELTS/academic themes, and functional language), and rebuild the vocabulary surfaces — the hub page, the topic page, and all three practice games — so they hold up at the new scale (2,706 unique words, topics up to 200+ words) and look professionally designed rather than functional-but-plain.

**Architecture:** Three independent layers, deliberately decoupled so they ship in any order.
(1) **Data layer** — a side-car classification file at the repo root (`vocab_topics/topics.tsv` + `mapping.tsv`) joined in at seed time, keyed on the word itself. The 51 `vocabulary.md` files are never touched. A `check-vocab-topics` script is the drift/coverage gate.
(2) **Presentation layer** — `/vocab` becomes a topic hub; `/vocab/[topic]` a topic page; both designed for volume (search, filters, grouped navigation). The lesson vocab flow at `/learn/[phase]/[lesson]/vocab` is untouched.
(3) **Game layer** — the three games are refactored onto shared primitives (`SessionSummary`, item transitions, a motion vocabulary in `globals.css`) and given a real interaction design. Games take a word list and are agnostic about whether it came from a lesson or a topic, which is why this layer can ship first.

**Tech Stack:** Existing only — Next.js 15 App Router, React 19, TypeScript, Tailwind v4 + shadcn/Base UI, Prisma 6 → Postgres 16, Vitest 4. **No new runtime dependencies**: all motion is CSS/Tailwind + pointer events, no animation library.

## Global Constraints

- **Design system is binding.** `docs/design/code-export/CLAUDE_CODE_PROMPT.md` governs: indigo-violet primary + coral accent, Be Vietnam Pro, 10px base radius, motion 120/200/320ms on `--ease-standard` (`cubic-bezier(.2,.8,.2,1)`), hit target ≥44px, WCAG AA both themes. Use existing CSS variables — **never** hardcode Tailwind palette colors (the current `text-emerald-600` usages are defects to remove, not precedent).
- **UI copy is Vietnamese**; English appears only as lesson content (words, examples).
- `prefers-reduced-motion` is already handled globally in `globals.css:216` — every new animation must degrade correctly under it.
- **Markdown stays the single source of truth.** The classification lives beside the content, never inside it; the 51 `vocabulary.md` files stay byte-identical.
- **Vocab seed remains delete+create** (user decision, 2026-09-01) — no upsert refactor in this plan. See "Accepted risks".
- Work happens directly on `main`.

## Context

**Current data (measured 2026-09-01):** 3,419 `VocabWord` rows / 51 lessons / **2,706 unique words**; 482 words appear in more than one lesson ("confirm" in 6); 17 words appear twice within the same lesson; 172 `groupName` values, most of them unusable as topics (the largest, "BẢNG TỪ VỰNG (70 TỪ)", covers 210 words). Only 20 `VocabProgress` rows exist, so there is effectively no learner progress at risk today.

**Why `groupName` cannot be reused:** it mixes grammatical classes ("Trạng từ tần suất", "Động từ bất quy tắc") with real topics ("Food & Drink", "Home & Objects") and table captions carrying no meaning, and it is scoped per lesson with no cross-lesson identity.

**Why a third topic group exists:** ~950 words are functional/rhetorical language, not about any real-world subject — 100 idioms, 159 AWL words, 160 chart/map description words, 160 linking/cohesion words, 143 phrasal verbs, 78 collocations, 72 reporting verbs. Forcing "however" into "Environment" would be nonsense, so the taxonomy has a FUNCTIONAL group.

**Game defects verified by reading the source:**
- The session-complete screen is copy-pasted three times (`Flashcards.tsx:85`, `QuizGame.tsx:133`, `MatchGame.tsx:219`), undesigned in all three.
- `text-emerald-600 dark:text-emerald-400` hardcoded at `Flashcards.tsx:90` and `QuizGame.tsx:138`, bypassing the `--success` token.
- No transition between items in any game — `setIndex` swaps content instantly.
- Flashcards has no swipe gesture on a mobile-first app, and its two report buttons sit `disabled` until the card is flipped with no explanation.
- Quiz forces an extra "Câu tiếp theo →" tap after every one of 10 answers.
- Match leaves solved tiles in place at `opacity-40` (`MatchGame.tsx:278`), so the board never shrinks; it also uses `rounded-lg`/`border-2`, off-system.

## Phase A — Game redesign (ships first; independent of everything else)

### A1. Motion + primitive foundation
- [ ] Add keyframes/utilities to `globals.css`: `item-in` / `item-out` (slide+fade, 200ms), `sweep` (correct-answer wash), `ring-fill` (SVG progress ring), `fly-off` (flashcard discard), `tile-collapse` (match clear), `badge-pop` (streak milestone). All on `--ease-standard`.
- [ ] Write `SessionSummary.test.tsx` first, then build `components/vocab/SessionSummary.tsx`: SVG progress ring animating from 0, count-up numbers, result tier (Xuất sắc / Tốt / Cần ôn lại) derived from the ratio, save-state line, primary action as `variant="accent"`, secondary as `outline`. Props cover all three games' stats (correct/total, best streak, elapsed time — each optional).
- [ ] Replace all three copy-pasted completion blocks with `SessionSummary`; delete the hardcoded emerald classes.

### A2. Flashcards
- [ ] Test-first: swipe threshold logic and keyboard handling extracted as pure functions in `components/vocab/games.ts` (`resolveSwipe(dx, threshold)` → `"know" | "dont-know" | "none"`).
- [ ] Pointer-event drag: card follows the finger with rotation proportional to dx; past threshold it flies off via `fly-off`; below threshold it springs back.
- [ ] Deck illusion: two dimmed, slightly scaled cards behind the active one.
- [ ] Flip gains `perspective` + a slight mid-flip scale; keyboard `←`/`→` report, `Space`/`Enter` flips.
- [ ] Remove the dead disabled state: before flipping, the action row shows a "Lật thẻ để trả lời" hint instead of two dead buttons.

### A3. Quiz
- [ ] Auto-advance 900ms after the answer is revealed (no "Câu tiếp theo" tap); keep an explicit button only on the final question ("Xem kết quả").
- [ ] Correct option: `sweep` wash left→right + check pop. Wrong: shake, then the correct option lifts with a delayed glow.
- [ ] Streak milestones at 5 and 10 trigger `badge-pop`; flame scales with tier.
- [ ] Item transition between questions via `item-out`/`item-in`.

### A4. Match
- [ ] Solved pairs `tile-collapse` out of the layout so the board shrinks as the round progresses.
- [ ] Selected tile lifts with a primary ring; wrong pair shakes both sides.
- [ ] Timer becomes a thin progress ring instead of plain text; personal best highlighted on beat.
- [ ] Normalize to system radius/borders (`rounded-xl`, single-width borders).

### A5. Verify
- [ ] `npm test` green; `npm run lint` clean.
- [ ] Manually exercise all three games in the running app and confirm reduced-motion behavior.

## Phase B — Topic data layer

### B1. Taxonomy + files
- [ ] Create `vocab_topics/topics.tsv` — 37 rows: `slug ⇥ nameVi ⇥ nameEn ⇥ emoji ⇥ group ⇥ orderIndex`.
  - EVERYDAY (13): `family-relationships`, `daily-routine`, `food-drink`, `home-objects`, `travel-transport`, `shopping-money`, `health-body`, `weather-nature`, `leisure-hobbies`, `emotions-personality`, `appearance`, `time-events`, `places-city`
  - ACADEMIC (12): `education`, `environment`, `technology`, `work-career`, `healthcare`, `media-social`, `crime-law`, `government-society`, `economy-business`, `culture-tradition`, `urbanisation-housing`, `globalisation`
  - FUNCTIONAL (12): `linking-cohesion`, `charts-trends`, `maps-processes`, `opinion-argument`, `reporting-verbs`, `comparison-contrast`, `academic-awl`, `idioms-colloquial`, `phrasal-verbs`, `collocations`, `quantity-data`, `cause-effect`
- [ ] Create empty `vocab_topics/mapping.tsv` (`word ⇥ topic_slug`) + `vocab_topics/README.md` documenting the conventions and how to re-check.

### B2. Loader + gate (test-first)
- [ ] `parse-vocab-topics.test.ts` → `parse-vocab-topics.ts`: parse both TSVs, key words on `lower(trim(word))`, skip blanks/comments, reject malformed rows. Mirrors the existing `overrides-loader.ts` pattern.
- [ ] `check-vocab-topics.test.ts` → `check-vocab-topics.ts`: reports `MISSING` (word in content, absent from mapping), `UNKNOWN_TOPIC`, `ORPHAN` (mapping row whose word no longer exists in content), `DUP_TOPIC`. Default mode prints a report and exits 0; `--check` exits 1 on any finding. Parses the 51 `vocabulary.md` via the existing `parseVocab` — no DB needed.
- [ ] Real-data guard test: `UNKNOWN_TOPIC`/`ORPHAN`/`DUP_TOPIC` must always be 0; `MISSING` must be `<=` a `MAX_UNCLASSIFIED` constant declared at the top of `check-vocab-topics.test.ts`, lowered with each classification batch and never raised (a raise means the mapping regressed).
- [ ] Add `make check-vocab`; call the report mode from `seed-all`.

### B3. Schema + seed
- [ ] Prisma migration: `VocabTopic` (`slug` unique, `nameVi`, `nameEn`, `emoji`, `group` enum `VocabTopicGroup`, `orderIndex`, `@@unique([group, orderIndex])`) and `VocabWord.topicId` (nullable, `onDelete: SetNull`, indexed).
- [ ] `ingest.ts`: upsert the 37 topics by slug before the lesson loop (topics are NOT delete+create); resolve `topicId` per word during vocab creation; print a classified/unclassified summary at the end.
- [ ] Integration test: topic assigned correctly, unclassified word gets `null`, re-seed does not duplicate topics.

## Phase C — Vocabulary page redesign (built for volume)

### C1. Shared query layer (test-first)
- [ ] `lib/vocab.ts` additions: `canonicalWordsForTopic(topicId)` applying the dedupe rule (`lower(trim(word))`, keep earliest phase→lesson→orderIndex); `getTopicVocabStats(userId, topicId)` computed over that same canonical set so 100% is reachable; `getTopicSessionWords(userId, topicId, limit = 20)` ordered by never-reviewed → lowest Leitner box → oldest `lastReviewedAt`.

### C2. `/vocab` hub
- [ ] Header: total progress ring ("đã thuộc X/2.706 từ") + a global search box that searches across every word and jumps to its topic.
- [ ] Segmented control pinned under the header to jump between the three groups (37 cards is too many for blind scrolling).
- [ ] Topic cards in a responsive grid (2 / 3 / 4 columns at base / ≥768px / ≥1024px): emoji tile tinted per group, Vietnamese name, English name, `x/y từ`, progress bar, hover lift, staggered `item-in` on mount.
- [ ] Filter chips: Tất cả / Đang học / Chưa bắt đầu / Đã thuộc.
- [ ] Empty topics render dimmed with a "Sắp có" badge — this is the Phase-2 content signal, deliberately visible.
- [ ] "Chưa phân loại" section renders only when its count > 0, at the bottom, muted.

### C3. `/vocab/[topic]`
- [ ] Sticky header: emoji, names, group badge, animated progress ring, and the three practice entries (`Thẻ ghi nhớ` / `Quiz` / `Ghép cặp`) wired to topic-scoped routes.
- [ ] Word list built for 200+ rows: in-page search, filter by Leitner state, sort (A→Z / theo bài / chưa thuộc trước), and an A–Z jump strip. Each row: word, IPA, meaning, `PronounceButton`, and a muted origin tag ("Bài 3 · GĐ 1").
- [ ] Rows render from the deduped canonical set so no word appears twice.

### C4. Topic-scoped game routes
- [ ] `/vocab/[topic]/{flashcards,quiz,match}` reusing the Phase-A components, fed by `getTopicSessionWords` (20-word sessions), with `backHref` pointing at the topic page.

## Phase D — Classification batches

- [ ] Batch 1 — phases 1–2 (~1,350 words, mostly EVERYDAY). Lower the `MISSING` ceiling.
- [ ] Batch 2 — whole-lesson FUNCTIONAL mappings, which are near-mechanical: idioms lesson → `idioms-colloquial`, both AWL lessons → `academic-awl`, Task 1 lessons → `charts-trends` / `maps-processes`, discourse+cohesion lessons → `linking-cohesion`, reported speech → `reporting-verbs`, collocations → `collocations`, phrasal-verb lessons → `phrasal-verbs` (~950 words).
- [ ] Batch 3..N — the remainder of phases 3–5 into ACADEMIC topics.
- [ ] Review pass: generate a per-topic word listing, skim for misclassified outliers, correct single TSV lines, re-seed.

## Phase E — Documentation

- [ ] `CLAUDE.md`: document `vocab_topics/` and `make check-vocab`.
- [ ] `docs/content-model.md`: the two TSV formats and the word-keyed convention.
- [ ] `docs/architecture.md`: add `VocabTopic` to the data model and the new routes to the route table.

## Accepted risks (decided 2026-09-01)

- **Vocab seed stays delete+create.** `ingest.ts:310` deletes `VocabWord` rows and `VocabProgress.wordId` is `onDelete: Cascade` (`schema.prisma:221`), so **every `make seed-all` wipes all learner Leitner progress**. The user accepted this and declined an upsert refactor, since only 20 progress rows exist today. This becomes a real hazard once the vocabulary section is actually used daily — revisit before that point.
- **One topic per word, globally.** A word with different senses in different lessons still gets a single topic. Accepted for a browsable vocabulary store; it is what makes the mapping consistent and 21% smaller.

## Deferred (not in this plan)

- **Stage 2 content authoring** — writing new vocabulary to fill thin topics (est. 1,000–2,500 new words with IPA, Vietnamese meaning, example, and generated audio). The hub's "Sắp có" badges will show where to start.
- **Leitner scheduling** — a real "ôn tập hôm nay" queue needs per-box review intervals; today `VocabProgress` records `lastReviewedAt` but no due date. Worth doing once the store is large, as a separate change.
