# CLAUDE.md — Agent Guide

Bilingual (Vietnamese/English) self-study English curriculum targeting IELTS
6.5–8.0. **Pure Markdown content repo — no application code yet** (a Next.js
app is planned under `web/`; see docs/superpowers/plans/).

## Start here

1. **Discovery:** read `index/manifest.json` — complete inventory of all
   phases, lessons, exams, and IELTS tests with titles, topics, and
   completeness flags. Human-readable version: `docs/STATUS.md`.
2. **File formats:** `docs/content-model.md` (schemas, answer-key
   conventions, known quirks). Architecture: `docs/architecture.md`.
   Flows: `docs/data-flow.md`.
3. Every content file has YAML frontmatter (`type`, `phase`/`test`, `topic`,
   `cefr`, `title`) — identify files without reading bodies.

## Layout

- `phase_<N>_<name>/lesson_<NN>_<slug>/` — `lecture.md` + `vocabulary.md` +
  `exercise.md` (answer key embedded; heading varies — search `ANSWER KEY` or
  `ĐÁP ÁN` in H1–H3, see docs/content-model.md; phase-5 writing/speaking
  exercises use inline `Gợi ý` model answers instead).
  Phases 1–5 map to CEFR A1-A2 → C1.
- `phase_<N>_<name>/exam/` — `phase<N>_exam.md` + `phase<N>_answer_key.md`.
- `ielts_practice_tests/test_<NN>/` — `reading.md`, `writing.md`,
  `speaking.md`, `answer_key.md` (test_01–test_30, all complete).
- `scripts/` — stdlib-Python tooling; `docs/` — knowledge base;
  `docs/plans/` — historical plans (frozen, don't update).
- `docs/design/` — the app's visual design system exports (self-contained,
  survive Claude-account changes): `code-export/` (design-system tokens +
  reference component code + screen shots + a ready-to-paste
  `CLAUDE_CODE_PROMPT.md`), `ux-refinements-export/`, `webapp-export/`. When
  doing any UI/design work, read the relevant `*_PROMPT.md` and its
  `*.dc.html` + `screens/` first and follow that system (indigo-violet
  primary + coral accent, Vietnamese UI copy).

## Commands

```bash
python3 -m unittest discover -s scripts/tests -v   # test the tooling
python3 scripts/add_frontmatter.py                 # frontmatter new content (idempotent)
python3 scripts/build_index.py                     # regenerate manifest + docs/STATUS.md
python3 scripts/build_index.py --check             # validate; exit 1 on drift
quarto render <file.md> --to pdf                   # PDF of one file (Quarto 1.6)
```

## Hard rules

- **Never modify exercise/exam/answer-key content when grading** — grading
  writes a new `score_report_<YYYY-MM-DD>.md` into the same folder
  (see `.claude/skills/grading-english-exercises/SKILL.md`).
- **Never invent answers**; answer keys are the only source of truth.
  Variants separated by `/` are all correct.
- **IELTS tests are scored on band 0–9** using that test's own raw→band
  table in its `answer_key.md` — never percentages, never another test's table.
- **Keep the bilingual convention**: Vietnamese headings/framing, English
  examples and explanations. Don't translate existing content.
- After adding/removing content files, rerun `python3 scripts/build_index.py`
  and commit the regenerated `index/manifest.json` + `docs/STATUS.md`.
- Work happens directly on `main`.

## Grading a learner's answers

Use the `grading-english-exercises` skill. Locator table:
lesson → key embedded in `exercise.md`; phase exam →
`phase_*/exam/phase<N>_answer_key.md`; IELTS → `test_<NN>/answer_key.md`.
