# Data Flow

## 1. Authoring flow

Author writes/edits lesson or test Markdown under `phase_*/`,
`ielts_practice_tests/`, or `toeic_practice_tests/` → runs
`python3 scripts/add_frontmatter.py`
(no-op for existing files; adds metadata to new ones) → runs
`python3 scripts/build_index.py` (refreshes `index/manifest.json` +
`docs/STATUS.md`) → commits content + regenerated artifacts together.
`python3 scripts/build_index.py --check` (exit 1 on drift) verifies before merge.

## 2. Learning & grading flow

Learner studies `lecture.md` + `vocabulary.md` → answers `exercise.md`
(or a phase exam / IELTS test) → invokes the `grading-english-exercises`
skill → the skill locates the answer key (embedded `## ANSWER KEY` for
lessons; `phase<N>_answer_key.md` for exams; `test_<NN>/answer_key.md` for
IELTS; `toeic_practice_tests/test_<NN>/answer_key.md` for TOEIC), scores
per its rubric, and writes `score_report_<YYYY-MM-DD>.md`
into the same folder. Exercise files are never modified by grading.
Learner feedback about content goes into a `feedback.md` in the lesson dir.

## 3. Agent retrieval flow

Agent reads `CLAUDE.md` (root) → for discovery reads `index/manifest.json`
(one file lists every lesson/test, titles, topics, completeness) → jumps
straight to the target file; frontmatter (`type`, `phase`, `topic`, `cefr`)
identifies any file without reading its body.

## 4. Web-app seed flow

`web/scripts/seed/ingest.ts` (`make seed`) walks the same content tree, parses
lessons, vocabulary and exercises into typed questions + answer variants, and
upserts them into Postgres. Two different idempotency strategies live here:

- **Lessons** are skipped when their `contentHash` (lecture + vocab + exercise)
  is unchanged, so re-seeding is cheap.
- **The Exercise and ListeningSet subtrees are deleted and recreated** on every
  run that touches them — question/answer rows are cheap to rebuild and this
  avoids drift from partially-edited keys.
- **Vocab topics are a third strategy.** `VocabTopic` rows are *upserted* by
  slug (never deleted, or every `VocabWord.topicId` would break), and topic
  assignment then runs a pass over **all** `VocabWord` rows independent of
  `contentHash`. It has to: editing only `vocab_topics/mapping.tsv` changes no
  lesson's hash, so a hash-gated pass would never apply it. The same pass
  clears `topicId` for words no longer in the mapping — which means a missing
  `vocab_topics/` directory wipes every topic in one run. `loadVocabTopics`
  now throws instead of returning an empty mapping, and `web/Dockerfile`
  COPYs the directory into both the `runner` and `test` stages.

`seed-placement.ts` and `seed-ielts.ts` cover the placement test and the 30
IELTS tests; `make seed-all` runs all three. Listening sets are *not* separate:
they come from `web/content/listening/*.md` and are seeded by `ingest.ts`
itself, so plain `make seed` already picks them up.

Parsers are per-format (`parse-lesson`, `parse-vocab`, `parse-exercise`,
`parse-listening`, `parse-vocab-topics`) and each has co-located tests. `overrides.json` +
`overrides-loader.ts` pin the question kind for items the parser would otherwise
misclassify. Two validators run outside the DB write path: `npm run
seed:validate` (`validate.ts`) and `npm run seed:validate-listening`
(`check-listening.ts`). A third, `make check-vocab`
(`check-vocab-topics.ts`), diffs `vocab_topics/` against the Markdown — see
`docs/content-model.md` for its four findings.

Content changes therefore flow one way: edit the Markdown → re-seed → the app
serves the new version. The seed never writes back to the Markdown, and answer
keys stay server-side (they become `Question` / `AnswerVariant` rows).

## 5. Audio flow

Listening audio is **pre-generated, never synthesized per request.**
`web/scripts/tts/generate_audio.py` reads a listening set's `voices:` front
matter (speaker letter → edge-tts voice), synthesizes each transcript line with
that speaker's voice, and writes MP3s into `web/public/audio/listening/`. It
refuses to run if any speaker is missing a voice mapping, and has a dry-run plan
mode.

Audio comes at two granularities, and **both are optional to the seed:**

- a whole-set `<slug>.mp3` — this is what currently exists for all 16 sets;
- a per-section `<slug>_s<N>.mp3` — supported end-to-end (the script can emit
  them and `ingest.ts` wires `sectionAudioUrl` when the file is on disk), but
  **none are generated yet**, so every section today falls back to the set-level
  track.

The seed *probes* rather than requires: `probeDurationSec` fills `durationSec`
when the MP3 exists and leaves it null otherwise, and a missing section file just
leaves `sectionAudioUrl` undefined. So a listening set can be seeded before its
audio exists, and regenerating audio needs a re-seed only to refresh durations
and pick up newly-added section tracks.

## 6. In-app answer flow

Learner opens `/learn/<phase>/<lesson>/exercise` → the runner posts to
`POST /api/exercises/[id]/attempts` (creates an `ExerciseAttempt`) → each
answer goes to `POST /api/attempts/[id]/answers`, which grades it server-side
via `lib/grading/` (normalize → match against `AnswerVariant`, with sentence
diffing for open answers), stores an `AttemptAnswer`, and returns only the
verdict. Once answered, a question flips to a read-only review rendered by
`ExerciseRunner` from the `AttemptAnswer` it already stored — the learner can go
back and re-read earlier questions, and no re-grading round-trip happens.

Listening uses `POST /api/listening/[slug]/check`, section by section.

## 7. Onboarding flow

A new user lands outside the app shell: `/onboarding/name` (writes `User.name`
via `POST /api/profile/name`) → `/onboarding/path`, where
`POST /api/onboarding/path` takes a goal that is a discriminated union — either
IELTS (`5.0`…`8.0`) or CEFR (`A1`…`C1`) → `/onboarding/placement`, whose wizard
posts `POST /api/placement/submit-section` per section then `/complete`, which
computes the band via `lib/placement*.ts` and writes it onto the `User`.
`/onboarding/placement/result` reads it back. `POST /api/placement/reset-to-start`
lets a learner redo the whole thing.

`web/src/middleware.ts` (edge) gates every authenticated route and imports only
the Prisma-free `lib/auth/auth.config.ts`, so it can run on the edge runtime.

## 8. Vocab review flow

Vocabulary uses **Leitner boxes 0–5** (`lib/vocab.ts`). Two surfaces feed it —
flashcards (`/vocab/<topic>/flashcards`, `/learn/<phase>/<lesson>/vocab/flashcards`)
and the merged practice session (`.../play`) — and both post to
`POST /api/vocab/review`: correct promotes a word one box (capped at 5), wrong
demotes it. A word counts as *learned* at `box >= 3` (`LEARNED_BOX_THRESHOLD`),
which is what lesson, topic and dashboard progress read.

A practice session may ask the same word several times (the review queue keeps
re-asking a missed word until two consecutive correct answers), but it posts
**one row per wordId**, `correct` = the word was never missed in that session.
That is not a simplification: `applyReviewResults` computes every result in a
batch off the same pre-batch snapshot, so two rows for one wordId would apply
two transitions to the same starting box and land on the wrong one.

A topic session draws at most 20 words (`getTopicSessionWords`), ranked
never-reviewed → lowest box → longest since last review, so repeated sessions
cycle through a large topic while staying on its weak words.

## 9. What is disposable and what is not

Everything the seed writes (`Phase`, `Lesson`, `Exercise`, `Question`,
`AnswerVariant`, `VocabWord`, `IeltsTest`, `ListeningSet`, `Section`) is
**derived from Markdown and can be rebuilt** with `make seed-all`.

Everything a learner produces — `User`, `LessonProgress`, `VocabProgress`,
`ExerciseAttempt`, `AttemptAnswer`, `PlacementAttempt` — exists **only** in the
`learning_english_db_data` volume and has no source of truth anywhere else. It
is not in the Markdown and not in git. See `docs/architecture.md` §Persistence.
