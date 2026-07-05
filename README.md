# Learning English — IELTS 6.5–8.0 Curriculum

A complete bilingual (Vietnamese/English) self-study English curriculum:
5 progressive phases (CEFR A1 → C1, 52 lessons) and 30 full IELTS practice
tests, all in Markdown.

- **Study:** pick your phase in `docs/STATUS.md`, read the lesson's
  `lecture.md` and `vocabulary.md`, then do `exercise.md`.
- **Get graded:** answer keys ship with every exercise/test; the
  `grading-english-exercises` Claude skill scores your answers and writes a
  detailed error report next to the exercise.
- **Status & inventory:** `docs/STATUS.md` (human) / `index/manifest.json`
  (machine) — regenerate with `python3 scripts/build_index.py`.
- **For AI agents:** start at [CLAUDE.md](CLAUDE.md) (a.k.a. `AGENTS.md`).
- **Docs:** architecture, content model, and data flow in [docs/](docs/).

Render any file to PDF with `quarto render <file.md> --to pdf`.
