# Data Flow

## 1. Authoring flow

Author writes/edits lesson or test Markdown under `phase_*/` or
`ielts_practice_tests/` → runs `python3 scripts/add_frontmatter.py`
(no-op for existing files; adds metadata to new ones) → runs
`python3 scripts/build_index.py` (refreshes `index/manifest.json` +
`docs/STATUS.md`) → commits content + regenerated artifacts together.
`python3 scripts/build_index.py --check` (exit 1 on drift) verifies before merge.

## 2. Learning & grading flow

Learner studies `lecture.md` + `vocabulary.md` → answers `exercise.md`
(or a phase exam / IELTS test) → invokes the `grading-english-exercises`
skill → the skill locates the answer key (embedded `## ANSWER KEY` for
lessons; `phase<N>_answer_key.md` for exams; `test_<NN>/answer_key.md` for
IELTS), scores per its rubric, and writes `score_report_<YYYY-MM-DD>.md`
into the same folder. Exercise files are never modified by grading.
Learner feedback about content goes into a `feedback.md` in the lesson dir.

## 3. Agent retrieval flow

Agent reads `CLAUDE.md` (root) → for discovery reads `index/manifest.json`
(one file lists every lesson/test, titles, topics, completeness) → jumps
straight to the target file; frontmatter (`type`, `phase`, `topic`, `cefr`)
identifies any file without reading its body.

## 4. Planned: web-app seed flow (not built yet)

`web/scripts/seed/ingest.ts` (planned) walks the same content tree, parses
exercises into typed questions + answer variants, and upserts into Postgres;
answer keys never reach the browser. Details:
`docs/superpowers/plans/2026-07-02-english-learning-web-app.md`.
