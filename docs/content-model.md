# Content Model

The "API" of this repository: every content file follows one of the schemas
below. Machine-readable inventory: `index/manifest.json` (regenerate with
`python3 scripts/build_index.py`).

## Frontmatter schema (all content files)

| Key | Example | Notes |
|---|---|---|
| `id` | `"phase_1_foundation/lesson_01_simple_present/lecture"` | repo-relative path minus `.md` |
| `type` | `lecture` | see type table below |
| `phase` | `1` | phase files only (1–5) |
| `test` | `1` | IELTS files only (1–30) |
| `lesson` | `lesson_01_simple_present` | lesson files only |
| `topic` | `"simple present"` | lesson slug, underscores → spaces |
| `cefr` | `A1-A2` | phase 1→A1-A2, 2→A2-B1, 3→B1-B2, 4→B2-C1, 5→C1, IELTS→C1 |
| `title` | `"BÀI 1: THÌ HIỆN TẠI ĐƠN (SIMPLE PRESENT TENSE)"` | first `#` heading |
| `lang` | `vi-en` | Vietnamese framing, English content |

`type` values: `lecture`, `vocabulary`, `exercise`, `phase_exam`,
`phase_exam_answer_key`, `ielts_reading`, `ielts_writing`, `ielts_speaking`,
`ielts_answer_key`, `score_report`, `feedback`.

## Lesson files — `phase_<N>_<name>/lesson_<NN>_<slug>/`

**`lecture.md`** (~290–320 lines): `# BÀI <N>: <TOPIC>` then `## GIỚI THIỆU`,
numbered `## PHẦN <N>: <TOPIC>` sections with `###` subsections. Vietnamese
explanations, English example sentences. Usually ends with a common-mistakes
section (`LỖI THƯỜNG GẶP`).

**`vocabulary.md`** (60–80 words): `## PHẦN 1: BẢNG TỪ VỰNG` with `### Nhóm
<X>: <theme>` groups, each a table
`| Word | Pronunciation /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |`,
followed by 3 practice exercises.

**`exercise.md`**: `## SECTION <A..H>: <NAME>` sections (heading text varies
per lesson); **question numbering is global and continuous across sections**;
ends with an embedded answer key holding per-section answers.

### Answer-key conventions (critical for graders/parsers)

- **The answer-key heading varies by phase** (match `ANSWER KEY` or `ĐÁP ÁN`
  in any H1–H3 heading, not one literal string): `## ANSWER KEY (ĐÁP ÁN)`
  (phase 1), `## ĐÁP ÁN (ANSWER KEY)` / `# ĐÁP ÁN (ANSWER KEY)` (phases 2–4),
  `# ANSWER KEY — ĐÁP ÁN` (some phase-3 lessons).
- **Phase-5 writing/speaking exercises have no answer-key section by design**
  — they are productive tasks with inline `Gợi ý` model answers and a
  `## BAND SCORE GUIDANCE` self-assessment instead (flagged as warnings by
  `scripts/build_index.py --check`; that is expected).
- Alternatives separated by `/`: `finishes / ends` — any listed variant is fully correct.
- Parenthetical acceptance notes: `made / gave (both acceptable)`.
- MCQ keys: `16. B (is having)`.
- Error correction: `34. "is know" → **knows** (explanation)`.
- Open-ended sections may say `Gợi ý đáp án` (suggested answers, not exact keys).
- Scoring rules live in `.claude/skills/grading-english-exercises/SKILL.md`.

### Known data quirks

- `phase_1_foundation/lesson_01_simple_present/exercise.md` has a student's
  answers filled into some blanks (`______cooks______`) — treat the ANSWER KEY
  section as the only source of truth.
- `phase_1_foundation/lesson_13_question_tags/` has **no `vocabulary.md`**
  (curriculum gap, tracked in `docs/STATUS.md`).
- Lesson dirs may also contain `score_report_<YYYY-MM-DD>.md` (grading output)
  and `feedback.md` (learner's notes to the content author).

## Phase exams — `phase_<N>_<name>/exam/`

`phase<N>_exam.md` (90-minute, 100-point exam) + `phase<N>_answer_key.md`
(separate answer key, may include a `BẢNG XẾP LOẠI` grading band table).

## IELTS practice tests — `ielts_practice_tests/test_<NN>/` (test_01–test_30, all complete)

- **`reading.md`**: 3 passages (~500/650/750 words), 40 questions
  (P1: Q1–13, P2: Q14–26, P3: Q27–40).
- **`writing.md`**: Task 1 (~175-word model) + Task 2 (~280-word model essay).
- **`speaking.md`**: Part 1 (12 Q+answers), Part 2 (cue card + 2-min model),
  Part 3 (10 Q+answers).
- **`answer_key.md`**: listening note (no audio in this repo), 40 reading
  answers, **a per-test raw-score→band conversion table (tables differ between
  tests — never reuse across tests)**, writing/speaking self-assessment
  checklists.
- Scoring is IELTS band 0–9, never percentages.
