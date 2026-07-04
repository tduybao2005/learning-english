# Learning English

A bilingual (Vietnamese/English) English-learning curriculum, plus a Next.js web app that serves it.

## What's in this repo

**Curriculum content** (Markdown, source of truth — read-only from the app's perspective):

- `phase_1_foundation/` … `phase_5_ielts_prep/` — 5 phases, ~52 lessons total. Each lesson has `lecture.md` (bài giảng), `vocabulary.md` (~60 words/lesson), and `exercise.md` (exercises with an embedded `## ĐÁP ÁN` / answer key).
- `ielts_practice_tests/test_01/` … `test_30/` — 30 full IELTS practice tests (Reading, Writing, Speaking, answer keys).
- `STATUS.md` — content-authoring progress tracker (Vietnamese).
- `_quarto.yml` — renders the Markdown curriculum to PDF via Quarto, independent of the web app.

**Web app** (`web/`):

A Next.js 15 app with Vietnamese UI that turns the curriculum above into an interactive product: email-OTP login, a placement test that assigns a starting lesson, sequential lesson unlocking, a retry-until-correct exercise runner, vocabulary flashcards/quiz/match games, a listening pipeline (TTS-generated audio), and an IELTS practice test browser.

The web app never edits the curriculum files — a seed pipeline parses them into a Postgres database at build/deploy time. See **[`web/README.md`](web/README.md)** for how to run it locally, environment variables, and the seeding procedure.

**Other tooling:**

- `.claude/skills/grading-english-exercises/` — a Claude Code skill that scores a completed lesson exercise, phase exam, or IELTS practice test and explains mistakes in detail.
- `docs/` — implementation plans and other working documents.
