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

**Table shapes are NOT uniform.** Column count ranges 3–6 and the order
varies, so `web/scripts/seed/parse-vocab.ts` reads each table's own header
row and maps columns to roles by keyword (`ipa|phát âm`, `nghĩa|meaning`,
`ví dụ|example`, plus a `cách dùng|usage` fallback); the first non-index
column is always the word. Missing roles fall back to `""` rather than
borrowing another column's data. Two tables carry words with **no** meaning
column at all and are still valid: the word-family grid in
`phase_3_intermediate/lesson_10_word_formation` (columns are Danh từ / Động
từ / Tính từ / Trạng từ). Do not add a rule that drops meaning-less tables —
it would silently delete those 25 words.

### Known data quirks

- `phase_4_advanced/lesson_06_vocabulary_nuances/vocabulary.md` has a
  **matrix** table under `### CẢM XÚC — GRADIENTS`: rows are intensity levels
  (`Nhẹ`, `Vừa`, … `Đỉnh cao`) and columns are emotion families. The parser
  takes column 0 as the word, so it emits the six Vietnamese level labels as
  fake "words" and drops the 24 real English ones (`content`, `irritated`,
  `euphoric`, `livid`, …). Those six are exactly the six words that
  `make check-vocab` still reports as unclassified. Structurally this table
  is indistinguishable from the valid word-family grid above, so the fix
  belongs in the content (add a standard vocabulary table alongside the
  matrix), not in a parser heuristic.
- `phase_1_foundation/lesson_01_simple_present/exercise.md` has a student's
  answers filled into some blanks (`______cooks______`) — treat the ANSWER KEY
  section as the only source of truth.
- `phase_1_foundation/lesson_13_question_tags/` has **no `vocabulary.md`**
  (curriculum gap, tracked in `docs/STATUS.md`).
- Lesson dirs may also contain `score_report_<YYYY-MM-DD>.md` (grading output)
  and `feedback.md` (learner's notes to the content author).

## Vocabulary topics — `vocab_topics/`

A side-car taxonomy that groups vocabulary by real-world topic rather than by
the lesson it happens to appear in. Two tab-separated files, both with a
header row; `#` starts a comment line.

**`topics.tsv`** — `slug  name_vi  name_en  emoji  group  order_index`.
`group` is one of `EVERYDAY` / `ACADEMIC` / `FUNCTIONAL`; `order_index` is the
display order *within* a group and must be unique per group. 37 rows.

**`mapping.tsv`** — `word  topic_slug`. The key is the word ALONE, lowercased
and trimmed — not word+lesson. A word appearing in several lessons therefore
gets one topic everywhere, which is what makes the deduplicated per-topic
counts add up. Assigning the same word to two different topics is a hard
error.

`make check-vocab` (`web/scripts/seed/check-vocab-topics.ts`) diffs the
mapping against every `vocabulary.md` and reports four findings:

| Finding | Meaning | Blocks? |
|---|---|---|
| `MISSING` | word in the Markdown, no mapping row | only under `--check` |
| `UNKNOWN_TOPIC` | mapping points at a slug not in `topics.tsv` | always |
| `ORPHAN` | mapping row for a word no longer in any lesson | always |
| `DUP_TOPIC` | duplicate slug, or two topics sharing a group+order | always |

`ORPHAN` is the one that catches drift when the Markdown is edited but the
mapping is not.

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

## TOEIC practice tests — `toeic_practice_tests/test_<NN>/`

Each test = 5 files (`type`: `toeic_listening`, `toeic_reading`,
`toeic_speaking`, `toeic_writing`, `toeic_answer_key`; `cefr: B1-C1`):

- **`listening.md`**: placeholder only — structured (PART 1–4 headings,
  Q1–100) but no question content yet, awaiting audio. Not counted as
  missing/incomplete; treat as "not yet available", not scored 0.
- **`reading.md`**: 100 questions, Q101–200 — Part 5 Incomplete Sentences
  (30 Qs, Q101–130), Part 6 Text Completion (16 Qs, Q131–146), Part 7
  Reading Comprehension (54 Qs, Q147–200: single/double/triple passages).
- **`speaking.md`**: 11 questions (ETS format: read aloud, describe a
  picture, respond to questions, respond using information provided,
  express an opinion), score 0–200, model answers under `#### Gợi ý
  (Model answer)`.
- **`writing.md`**: 8 questions (sentence-based-on-a-picture, respond to a
  written request, opinion essay), score 0–200, model answers.
- **`answer_key.md`**: Listening section notes "chưa có audio" (no
  scoring yet); Reading answers Q101–200; **a per-test raw→scaled
  conversion table for Listening and Reading, each 5–495 (total
  10–990) — tables differ between tests, never reuse across tests**;
  Speaking and Writing ETS-style descriptor rubrics, each 0–200.
- Scoring is TOEIC scaled score (L&R 5–495 each via that test's own
  table, total 10–990; Speaking/Writing 0–200 via rubric) — never
  percentages, never IELTS bands, never another test's table. If the
  learner has only done Reading (Listening has no audio), report only
  the Reading scaled score and note Listening as not yet taken.
