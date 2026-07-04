# Auto-Scoring & Error-Explanation Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-skills (skill creation IS TDD for documentation) together with superpowers:subagent-driven-development to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one reusable skill, `grading-english-exercises`, that takes a learner's completed answers to any lesson `exercise.md`, phase exam, or IELTS practice test in this curriculum, scores them on a standard rubric, and explains every error in detail in Vietnamese.

**Architecture:** A project-scoped Claude Code skill at `.claude/skills/grading-english-exercises/`. The skill is a *technique + reference* guide: it tells the agent (1) where each content type keeps its answer key, (2) how to allocate points and convert to a 4-tier band, and (3) the exact Vietnamese report template for explaining errors. No application code — the agent does the grading by following the skill; supporting files are Markdown templates only.

**Tech Stack:** Markdown skill (`SKILL.md` + Markdown templates), YAML frontmatter, Bash for read-only verification (`grep`/`wc`). Bilingual output: Vietnamese explanations, English example sentences.

## Global Constraints

- **Language rule:** All detailed error explanations and study recommendations in **English**. Report section headings and band labels may keep their existing Vietnamese form (mirroring the curriculum), but every explanation of *why* an answer is right/wrong is written in English.
- **No new tooling / no runtime code execution** beyond Markdown authoring and read-only verification. The skill performs grading via agent reasoning, not a script.
- **Single skill, project-scoped:** `.claude/skills/grading-english-exercises/` inside the repo so it is versioned with the curriculum and discoverable in this project. (Promote to `~/.claude/skills/` later only if reused across other repos.)
- **Reuse existing answer keys** — never invent answers. Lesson keys are embedded in `exercise.md` under `## ANSWER KEY (ĐÁP ÁN)`; phase exams use `exam/phaseN_answer_key.md`; IELTS tests use `test_NN/answer_key.md`.
- **IELTS tests use the IELTS band scale (0–9), never the 0–100 percentage.** Reuse the existing raw-score → band table in each `answer_key.md` for reading (each test's own table); estimate writing/speaking bands from that test's descriptor rubric (labeled a self-estimate). Never apply the lesson 0–100 band table to an IELTS test.
- **Skill authoring follows superpowers:writing-skills** — frontmatter `name`+`description` (description = *when to use*, no workflow summary), keyword-rich, one excellent worked example, TDD (baseline test → write → verify with subagents).

## Context

This repository is a bilingual English-learning curriculum (5 phases × lessons, plus 50 IELTS practice tests). Every exercise already ships a correct-answer key, but the keys are terse — they give the right answer with at most a one-line note (see `phase_1_foundation/lesson_01_simple_present/exercise.md` lines 186–245). There is **no consistent scoring scheme** for lesson exercises (only the phase exams have a partial `BẢNG XẾP LOẠI`, e.g. `phase_3_intermediate/exam/phase3_answer_key.md` lines 78–84), and **no detailed per-question error explanation** telling a learner *why* their answer is wrong and which rule to review.

Rather than hand-author static scoring + explanation files for 50+ exercises and tests, this plan builds **one skill** the learner invokes after finishing any exercise. The skill scores their submission and produces a detailed, consistent error report on demand. This is the right tool because the task (a) repeats across ~50 lessons + 5 exams + 50 IELTS tests, (b) requires judgment (explaining *why* an answer is wrong, mapping errors to lessons), and (c) benefits from one standardized rubric and report shape everywhere.

Decisions carried in from clarification:
- **Separate output:** the skill writes a new report file per submission; it never edits `exercise.md`.
- **Full per-question detail:** every wrong answer gets a complete explanation (rule + why correct + why the learner's answer is wrong + common-mistake note); correct answers get a one-line confirmation.
- **Points + 4-tier band table (0–100%)** as the standard scale for lessons and exams; **IELTS tests report the IELTS band (0–9)** — reading from its native raw→band table, writing/speaking as an estimated band — and never a percentage.

---

## Skill Standards (the skill must encode these verbatim)

### STANDARD-LOCATE (where the answer key lives, by content type)

| Content type | Exercise file | Answer key source | Scoring scale |
|---|---|---|---|
| Lesson exercise | `phase_*/lesson_*/exercise.md` | embedded `## ANSWER KEY (ĐÁP ÁN)` in same file | points + band table |
| Phase exam | `phase_*/exam/phaseN_exam.md` | `phase_*/exam/phaseN_answer_key.md` | points + band table (reuse exam's own rubric if present) |
| IELTS test | `ielts_practice_tests/test_NN/{reading,writing,speaking}.md` | `ielts_practice_tests/test_NN/answer_key.md` | **IELTS band 0–9, never 0–100%** — reading: native raw→band table; writing/speaking: estimated band from descriptor rubric + checklist |

### STANDARD-SCORING (point allocation)

- **Objective items** — fill-in-the-blank, multiple choice, sentence transformation, error correction, gap-fill, matching, T/F/NG: **1 point each**.
- **Productive items** — VN→EN translation, short writing/speaking prompts: **2 points each**, scored as 1 point grammar accuracy + 1 point meaning/vocabulary (half-credit allowed).
- **Acceptable-variant rule:** the keys list alternatives with `/` (e.g. `finishes / ends`, `which/that`) or parenthetical notes (e.g. `made / gave (both acceptable)`). Any listed variant is fully correct; ignore differences in capitalization, surrounding whitespace, and contraction spelling (`doesn't` = `does not`).
- **Total (lessons & phase exams)** = sum of item points. **Percentage** = `round(earned / total × 100)`. IELTS tests do NOT use this percentage — see the IELTS band rule below.
- **Band table (lessons & exams):**

  | Điểm (%) | Xếp loại | Hành động |
  |---|---|---|
  | 90–100 | Xuất sắc | Sang bài/đề tiếp theo ngay |
  | 75–89 | Giỏi | Tiếp tục; lướt lại câu sai |
  | 60–74 | Khá | Ôn lại phần yếu trước khi tiếp |
  | < 60 | Cần ôn lại | Học lại `lecture.md` của bài rồi làm lại |

- **IELTS practice tests — band scale only (never 0–100%):** IELTS tests are scored on the IELTS band (0–9), not on the percentage/Xếp loại table above.
  - **Reading:** count raw correct out of 40, then read the raw-score → band conversion table printed inside *that* test's `answer_key.md` and report the band it yields. Use each test's own table verbatim — the tables differ (e.g. `test_01` stops at band 4.5; `test_30` extends to band 4.0 for 10–12 correct). Never hardcode one table for all tests.
  - **Writing & speaking:** not objectively gradable, but still report an **estimated band (0–9)**. Map the response against the band-descriptor rubric in that test's `answer_key.md` (e.g. `test_30`'s Task Achievement / Coherence / Lexical Resource / Grammatical Range rows for writing and Fluency / Lexical / Grammar / Pronunciation rows for speaking, Bands 6–8). Where a test ships only a pass/fail self-assessment checklist, derive the estimate from how many checklist items pass. Always label writing/speaking bands explicitly as a **self-estimate**, not an official score, and still list which checklist/descriptor items pass or fail.
  - **Overall:** report each section's band and an **Overall Band** = average of the available section bands, rounded to the nearest 0.5 (IELTS rounding). Note that listening is not included in this curriculum.

### STANDARD-EXPLANATION (per wrong answer)

For each incorrect item, output this block (explanations in **English**):

```
**Q<N> — Incorrect**
- Correct answer: `<correct>`  |  Your answer: `<learner>`
- ✅ Why it's correct: <rule applied to this sentence>
- ❌ Why yours is wrong: <the specific error in the learner's answer>
- 📘 Rule: <grammar/vocab rule + pointer to the lesson section, e.g. "see lecture.md – PHẦN 2">
- ⚠️ Tip: <common-mistake note / memory tip>
```

Correct items get a single confirmation line: `**Q<N> — Correct** ✅ <one-clause why>`.

### STANDARD-REPORT (output file shape)

The skill writes `score_report_<YYYY-MM-DD>.md` into the exercise's own folder. The report shape branches on content type.

**Lessons & phase exams (0–100 scale):**
1. `# BÁO CÁO CHẤM ĐIỂM` header — exercise name, date, total items.
2. `## BẢNG ĐIỂM THEO PHẦN` — table: `Phần | Số câu | Đúng | Điểm`.
3. `## TỔNG KẾT` — total points, percentage, **Xếp loại** (from the 0–100 band table), recommended action.
4. `## GIẢI THÍCH LỖI CHI TIẾT` — the per-item blocks from STANDARD-EXPLANATION.
5. `## SỔ GHI LỖI` — table grouping mistakes by type: `Loại lỗi | Số câu | Câu số | Quy tắc cần ôn`.
6. `## KHUYẾN NGHỊ` — which lessons/sections to review, inferred from the error groups.

**IELTS practice tests (band scale 0–9):** same header (1), error-detail (4), error-log (5), and recommendation (6) sections, but replace the score summary (2–3) with band reporting:
2. `## BẢNG ĐIỂM THEO KỸ NĂNG` — table: `Kỹ năng | Raw / Items | Band`, with rows for Reading (raw `/40` → band), Writing (estimated band), Speaking (estimated band).
3. `## TỔNG KẾT (IELTS BAND)` — Reading band (from this test's raw→band table), Writing/Speaking **estimated** bands, and an **Overall Band** (average of available bands, rounded to nearest 0.5). NO percentage and NO Xếp loại here. State explicitly that writing/speaking bands are self-estimates and that listening is not covered.

For IELTS, section 4 (`GIẢI THÍCH LỖI CHI TIẾT`) covers reading per-item blocks plus which writing/speaking descriptor/checklist criteria were met or missed; section 5 groups reading mistakes by question type (T/F/NG, matching headings, etc.); section 6 recommends which IELTS skills/question types to drill.

### STANDARD-SUBMISSION (how the learner provides answers)

The skill accepts learner answers as either: a numbered list pasted in chat, or a path to an answer file. A copy-paste template ships as `answer-sheet-template.md` (numbered blanks 1..N).

---

## File Structure

```
.claude/skills/grading-english-exercises/
  SKILL.md                 # main guide: when-to-use, locate→score→explain→report workflow, worked example
  report-template.md       # STANDARD-REPORT skeleton the agent fills in
  answer-sheet-template.md # STANDARD-SUBMISSION blank for learners
```

Keep the scoring rubric and band table **inline** in `SKILL.md` (small, judgment-relevant). Templates go in separate files because they are reusable artifacts the agent copies.

---

## Task 1: RED — Baseline test (no skill yet)

**Files:**
- Create: `/tmp/claude-1000/.../scratchpad/baseline_answer_sheet.md` (a learner submission with deliberate, varied errors)

**Interfaces:**
- Produces: a documented list of baseline failures the skill must fix (drives Task 2 content).

- [ ] **Step 1: Build a realistic learner submission with seeded errors.** Take `phase_1_foundation/lesson_01_simple_present/exercise.md` (Sections A–E, 47 items) and write an answer sheet that is ~70% correct, including: a missing third-person `-s` (e.g. Q16 `teach`), an `always is` word-order error, a `Do/Does` agreement error, and one weak translation. Save to the scratchpad.

- [ ] **Step 2: Run a fresh subagent WITHOUT the skill.** Prompt: *"Score this learner's answers against the answer key in exercise.md and explain their errors."* Provide both files.

- [ ] **Step 3: Document the baseline gaps verbatim.** Expected failures to capture: inconsistent/absent point totals, no band/grade, shallow "you wrote X, answer is Y" with no rule or why, no error log, no study recommendation, mishandling of `/`-variant acceptable answers. These become the checklist Task 2 must satisfy.

No commit (scratchpad only).

---

## Task 2: GREEN — Write the skill

**Files:**
- Create: `.claude/skills/grading-english-exercises/SKILL.md`
- Create: `.claude/skills/grading-english-exercises/report-template.md`
- Create: `.claude/skills/grading-english-exercises/answer-sheet-template.md`

**Interfaces:**
- Produces: the `grading-english-exercises` skill consumed by every later invocation and by Tasks 3–4 tests.

- [ ] **Step 1: Write `SKILL.md` frontmatter.**

```markdown
---
name: grading-english-exercises
description: Use when a learner has completed a lesson exercise.md, a phase exam, or an IELTS practice test in this English curriculum and wants their answers scored and their mistakes explained in detail.
---
```

(Description states *when to use* only — no workflow summary, per writing-skills SDO.)

- [ ] **Step 2: Write the `SKILL.md` body** with these sections, encoding the standards above:
  1. `## Overview` — one-line core principle: locate the key → score on a fixed rubric → explain every error in English → emit a report file.
  2. `## When to Use` — bullets with triggers ("đã làm xong bài tập", "chấm điểm", "giải thích lỗi", "score my answers", phase exam, IELTS test); when NOT to use (no answer key available, or learner only wants the correct answer with no grading).
  3. `## Workflow` — numbered: (1) identify content type & locate answer key via STANDARD-LOCATE table; (2) collect learner answers (STANDARD-SUBMISSION); (3) compare item-by-item applying the acceptable-variant rule; (4) score via STANDARD-SCORING; (5) fill `report-template.md`; (6) save `score_report_<date>.md` to the exercise folder.
  4. `## Scoring Rubric` — paste the STANDARD-SCORING point rules and band table inline.
  5. `## Explaining Errors` — paste the STANDARD-EXPLANATION block format inline.
  6. `## Worked Example` — ONE complete example: ~6 items from `lesson_01_simple_present` (mixing a fill-in, an MCQ with a wrong distractor, an error-correction, and a translation), showing the scored result and two full error blocks. This is the single excellent example writing-skills calls for.
  7. `## Common Mistakes` — grader pitfalls: marking a valid `/`-variant wrong; reporting a 0–100 percentage or Xếp loại for an IELTS test (IELTS uses the band scale 0–9 only); giving IELTS writing/speaking an unlabeled band instead of a clearly marked self-estimate; using one test's raw→band table for a different test; forgetting the error log / recommendations; writing explanations in Vietnamese instead of English.
  8. `## Quick Reference` — the STANDARD-LOCATE table.

- [ ] **Step 3: Write `report-template.md`** — BOTH STANDARD-REPORT variants: (a) the 0–100 lesson/exam skeleton (`BẢNG ĐIỂM THEO PHẦN` + `TỔNG KẾT` with percentage/Xếp loại placeholders), and (b) the IELTS band skeleton (`BẢNG ĐIỂM THEO KỸ NĂNG` + `TỔNG KẾT (IELTS BAND)` with Reading/Writing/Speaking band and Overall Band placeholders, and NO percentage). Label which variant to use per content type.

- [ ] **Step 4: Write `answer-sheet-template.md`** — header instructions + a numbered `1. ____` … list the learner copies and fills.

- [ ] **Step 5: Lint the frontmatter.**

Run: `head -5 .claude/skills/grading-english-exercises/SKILL.md`
Expected: valid YAML, `name: grading-english-exercises`, description starts with "Use when".

- [ ] **Step 6: Commit.**

```bash
git add .claude/skills/grading-english-exercises/
git commit -m "feat: add grading-english-exercises skill (score + explain errors)"
```

---

## Task 3: GREEN-verify — Re-run the baseline scenario WITH the skill

**Files:**
- Test artifact: reuse `scratchpad/baseline_answer_sheet.md` from Task 1

- [ ] **Step 1: Run a fresh subagent WITH the skill loaded**, same prompt and same answer sheet as Task 1 Step 2.

- [ ] **Step 2: Verify the output against the baseline gap list.** The report MUST now contain: a per-section score table, a total + percentage + band label from the STANDARD band table, a full STANDARD-EXPLANATION block (in English) for every seeded error, a `SỔ GHI LỖI` grouping, and a `KHUYẾN NGHỊ` section. The `/`-variant answers (e.g. `finishes / ends`) must be scored correct.

- [ ] **Step 3: Confirm the report file landed** in the lesson folder.

Run: `ls phase_1_foundation/lesson_01_simple_present/score_report_*.md`
Expected: one report file exists. (This file is a test artifact — delete before committing: `git clean -n` should not show it staged.)

- [ ] **Step 4: If any gap remains, fix `SKILL.md`** (add the missing instruction or tighten the template) and re-run Step 1 until all baseline gaps are closed. Commit only skill changes.

```bash
git add .claude/skills/grading-english-exercises/SKILL.md
git commit -m "fix: close grading-skill gaps found in verification"
```

---

## Task 4: REFACTOR — Generalize across content types

The lesson case works; confirm the skill handles the two harder content types (separate answer-key file; native IELTS band table).

- [ ] **Step 1: Phase-exam scenario.** Give a fresh subagent (with skill) a partial answer set for `phase_3_intermediate/exam/phase3_exam.md` and the key file `phase3_answer_key.md`. Verify it reads the **separate** key file, applies the points+band table, and explains errors. If it failed to look in `exam/phaseN_answer_key.md`, strengthen the STANDARD-LOCATE instruction in `SKILL.md`.

- [ ] **Step 2: IELTS scenario.** Give it a reading answer set for `ielts_practice_tests/test_01/` plus `answer_key.md`, and a writing/speaking response for a test that ships a band-descriptor rubric (e.g. `test_30`). Verify it (a) reports the Reading band from *that* test's raw→band table — NOT a 0–100 percentage and NOT the lesson Xếp loại; (b) produces an **estimated** band (0–9) for writing/speaking from the descriptor rubric, explicitly labeled a self-estimate, plus the checklist pass/fail; (c) reports an **Overall Band** averaged to the nearest 0.5. If it emitted a percentage/Xếp loại for an IELTS test, or an unlabeled writing/speaking score, strengthen STANDARD-SCORING and `## Common Mistakes`.

- [ ] **Step 3: Re-confirm the lesson case still passes** (no regression) by re-reading the Task 3 report criteria.

- [ ] **Step 4: Commit any refinements.**

```bash
git add .claude/skills/grading-english-exercises/
git commit -m "refactor: generalize grading skill to phase exams and IELTS tests"
```

---

## Verification (end-to-end)

- [ ] **Skill is discoverable & well-formed:**

```bash
test -f .claude/skills/grading-english-exercises/SKILL.md && \
grep -q "^name: grading-english-exercises" .claude/skills/grading-english-exercises/SKILL.md && \
grep -q "^description: Use when" .claude/skills/grading-english-exercises/SKILL.md && echo "frontmatter OK"
```
Expected: `frontmatter OK`.

- [ ] **All three skill files present:**

```bash
ls .claude/skills/grading-english-exercises/
```
Expected: `SKILL.md`, `report-template.md`, `answer-sheet-template.md`.

- [ ] **Standards encoded (keyword smoke test):**

```bash
grep -l "BẢNG ĐIỂM THEO PHẦN\|GIẢI THÍCH LỖI\|SỔ GHI LỖI" .claude/skills/grading-english-exercises/*.md
grep -q "Xuất sắc\|Cần ôn lại" .claude/skills/grading-english-exercises/SKILL.md && echo "band table OK"
```
Expected: report-template matches the three report headings; `band table OK`.

- [ ] **IELTS band variant present (keyword smoke test):**

```bash
grep -q "TỔNG KẾT (IELTS BAND)\|BẢNG ĐIỂM THEO KỸ NĂNG" .claude/skills/grading-english-exercises/*.md && echo "IELTS band report OK"
grep -q "IELTS band (0–9)\|never the 0–100\|estimated band" .claude/skills/grading-english-exercises/SKILL.md && echo "IELTS scoring rule OK"
```
Expected: `IELTS band report OK` and `IELTS scoring rule OK`.

- [ ] **No test artifacts committed:**

```bash
git status --porcelain | grep score_report_ && echo "REMOVE THESE" || echo "clean"
```
Expected: `clean`.

- [ ] **Live acceptance run:** invoke the skill on a real, freshly completed lesson submission and read the report — it should score correctly, grade with a band, and explain each error with rule + why-wrong + tip in Vietnamese.

---

## Self-Review notes

- **Spec coverage:** scoring system ✓ (STANDARD-SCORING: 0–100% for lessons/exams, IELTS band 0–9 for IELTS tests), explain errors in detail ✓ (STANDARD-EXPLANATION), applies to each lesson ✓, each phase exam ✓, IELTS tests ✓ (STANDARD-LOCATE covers all three; Task 4 verifies the two non-lesson types).
- **Carried decisions honored:** separate output file (never edits `exercise.md`) ✓; full per-question detail ✓; 0–100 points + 4-tier band table for lessons/exams ✓; **IELTS tests scored on the IELTS band (0–9), reading via native table + writing/speaking as labeled self-estimate, never a percentage** ✓; **error explanations written in English** ✓.
- **TDD-for-skills:** RED (Task 1 baseline) → GREEN (Task 2 write, Task 3 verify) → REFACTOR (Task 4 generalize), per superpowers:writing-skills.
- **No placeholders:** frontmatter, rubric, band table, explanation block, and report shape are all fully specified; the only thing authored at run time is the per-submission content, which is the skill's whole purpose.
- **Plan storage:** on execution, also save a copy of this plan as `plan_v3_scoring_skill.md` in the repo root to match the existing `plan.md` / `plan_v2.md` convention.
```