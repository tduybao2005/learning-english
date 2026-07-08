---
name: grading-english-exercises
description: Use when a learner has completed a lesson exercise.md, a phase exam, or an IELTS practice test in this English curriculum and wants their answers scored and their mistakes explained in detail.
---

## Overview

Locate the answer key → score on a fixed rubric → explain every error in English → write a report file.

## When to Use

**Use this skill when the learner says things like:**
- "Chấm điểm bài tập của tôi" / "Score my answers"
- "Giải thích lỗi sai" / "Explain my errors"
- "Tôi đã làm xong bài tập / đề thi / IELTS test"
- "Check my exercise", "Grade this", "How did I do?"

**Do NOT use when:**
- No answer key exists for the content (never invent answers)
- The learner only wants the correct answer with no grading ("what is the answer to Q5?")

## Workflow

1. **Identify content type and locate the answer key** using STANDARD-LOCATE below.
2. **Collect learner answers** — numbered list in chat, or path to an answer file. If missing, show `answer-sheet-template.md` and ask the learner to fill it.
3. **Compare item-by-item**, applying the acceptable-variant rule (see STANDARD-SCORING).
4. **Score** using STANDARD-SCORING. Tally per section, compute total and percentage.
5. **Fill `report-template.md`** — write each section: header, score table, summary + band, per-item explanations, error log, recommendations.
6. **Save** the completed report as `score_report_<YYYY-MM-DD>.md` into the **same folder as the exercise** (never edit exercise.md itself).

---

## STANDARD-LOCATE

| Content type | Exercise file | Answer key location | Scoring scale |
|---|---|---|---|
| Lesson exercise | `phase_*/lesson_*/exercise.md` | Embedded `## ANSWER KEY (ĐÁP ÁN)` section in same file | Points + band table (this file) |
| Phase exam | `phase_*/exam/phaseN_exam.md` | `phase_*/exam/phaseN_answer_key.md` (separate file) | Points + band table (reuse exam's rubric if present) |
| IELTS test | `ielts_practice_tests/test_NN/{reading,writing,speaking}.md` | `ielts_practice_tests/test_NN/answer_key.md` | **IELTS band 0–9, never 0–100%** — reading: native raw→band table; writing/speaking: estimated band from descriptor rubric + checklist |
| TOEIC test | `toeic_practice_tests/test_NN/{listening,reading,speaking,writing}.md` | `toeic_practice_tests/test_NN/answer_key.md` | **TOEIC scaled score, never percentages/IELTS bands** — Listening & Reading: raw→scaled 5–495 each via that test's own table (total 10–990); Speaking & Writing: 0–200 each via ETS-style rubric. Listening has no audio yet in this repo → report "chưa thi", not 0 |

---

## STANDARD-SCORING

### Point allocation

- **Objective items** (fill-in-the-blank, multiple choice, sentence transformation, error correction, gap-fill, matching, T/F/NG): **1 point each**.
- **Productive items** (Vietnamese→English translation, short writing/speaking prompts): **2 points each**:
  - 1 point for grammar accuracy
  - 1 point for meaning/vocabulary
  - Half-credit (1 pt) is allowed when meaning is conveyed but grammar errors remain, or vice versa.
- **Acceptable-variant rule:** Keys list alternatives with `/` (e.g. `finishes / ends`) or parenthetical notes (e.g. `made / gave (both acceptable)`). Any listed variant = fully correct. Ignore differences in capitalization, surrounding whitespace, and contraction spelling (`doesn't` = `does not`).
- **Total (lessons & phase exams)** = sum of item points. **Percentage** = `round(earned / total × 100)`. IELTS tests do NOT use this percentage — see the IELTS band rule below.

### Band table (lessons and phase exams)

| Điểm (%) | Xếp loại | Hành động |
|---|---|---|
| 90–100 | Xuất sắc | Sang bài/đề tiếp theo ngay |
| 75–89 | Giỏi | Tiếp tục; lướt lại câu sai |
| 60–74 | Khá | Ôn lại phần yếu trước khi tiếp |
| < 60 | Cần ôn lại | Học lại `lecture.md` của bài rồi làm lại |

**IELTS practice tests — band scale only (never 0–100%):** IELTS tests are scored on the IELTS band (0–9), not on the percentage/Xếp loại table above.
- **Reading:** Count raw correct out of 40, then read the raw-score → band conversion table printed inside *that* test's `answer_key.md` and report the band it yields. Use each test's own table verbatim — the tables differ between tests. Never use one test's table for another test.
- **Writing & speaking:** Not objectively gradable, but still report an **estimated band (0–9)**. Map the response against the band-descriptor rubric in that test's `answer_key.md`. Where a test ships only a pass/fail self-assessment checklist, derive the estimate from how many checklist items pass. Always label writing/speaking bands explicitly as a **self-estimate**, not an official score, and list which checklist/descriptor items pass or fail.
- **Overall Band:** Report each section's band and compute an **Overall Band** = average of available section bands, rounded to the nearest 0.5 (IELTS rounding). Note that listening is not included in this curriculum.

**TOEIC practice tests — scaled score only (never percentages, never IELTS bands):**
- **Listening:** This repo's Listening files are placeholders awaiting audio. Never score Listening as 0 — report **"Listening: chưa thi"** and omit it from any total.
- **Reading:** Count raw correct out of 100 (Q101–200), then read the raw→scaled conversion table printed inside *that* test's `answer_key.md` and report the scaled score (5–495). Use each test's own table verbatim — tables differ between tests; never reuse one test's table for another.
- **Listening & Reading total:** Report a combined L&R total (10–990) **only when both Listening and Reading have actually been taken/scored**. If Listening was not taken, report the Reading scaled score alone and do not compute a total.
- **Speaking & Writing:** Score each 0–200 by mapping the response against the ETS-style descriptor rubric in that test's `answer_key.md`. Report Speaking and Writing scores separately — do not average or combine them with L&R.
- Every score report records each of the four skills separately (Listening/Reading/Speaking/Writing); combine Listening+Reading into one total only when both are present.

---

## STANDARD-EXPLANATION

### For each incorrect item

```
**Q<N> — Incorrect**
- Correct answer: `<correct>`  |  Your answer: `<learner>`
- ✅ Why it's correct: <rule applied to this specific sentence>
- ❌ Why yours is wrong: <the specific error in the learner's answer>
- 📘 Rule: <grammar/vocab rule + pointer, e.g. "Third-person singular -s — see lecture.md – PHẦN 2: CẤU TRÚC CÂU KHẲNG ĐỊNH">
- ⚠️ Tip: <common-mistake note or memory tip>
```

### For each correct item

```
**Q<N> — Correct** ✅ <one clause explaining why this answer is right>
```

### For half-credit productive items

```
**Q<N> — Partial credit (1/2 pts)**
- Model answer: `<sample>`  |  Your answer: `<learner>`
- ✅ What you got right: <meaning conveyed / grammar dimension that passed>
- ❌ What to fix: <the specific grammar or vocabulary error>
- 📘 Rule: <rule + lecture pointer>
- ⚠️ Tip: <common-mistake note>
```

All explanation text (the content after the labels) must be written in **English**. Vietnamese is used only for section headings and band labels.

---

## Worked Example

**Context:** Learner submits answers for `phase_1_foundation/lesson_01_simple_present/exercise.md`.

**Sample of 6 learner answers (Q1, Q16, Q19, Q36, Q42, Q20):**

| Q | Learner | Key |
|---|---------|-----|
| Q1 | cooks | cooks |
| Q16 | A (teach) | B (teaches) |
| Q19 | A (Do) | C (Does) |
| Q36 | "always is" → is always | "always is" → is always |
| Q42 | My sister wake up at 5am because she work far from home. | My sister wakes up at 5am because she works far from home. |
| Q20 | B (revolves) | B (revolves) |

**Step 1 — Scoring these 6 items:**

- Q1: objective, correct → 1/1
- Q16: objective, wrong → 0/1
- Q19: objective, wrong → 0/1
- Q36: objective, correct → 1/1
- Q42: productive (2pts), meaning OK but grammar errors (missing -s twice) → 1/2
- Q20: objective, correct → 1/1

Sub-total: 4/7 for these 6 items.

**Step 2 — Per-item explanations:**

**Q1 — Correct** ✅ "Cook" takes the third-person singular -s because the subject is "my mother" (= she).

**Q16 — Incorrect**
- Correct answer: `B (teaches)`  |  Your answer: `A (teach)`
- ✅ Why it's correct: The subject is "she" (implied by the proper noun), a third-person singular subject, so the verb needs the -s/-es suffix: "teaches".
- ❌ Why yours is wrong: "teach" is the base form, used with I / you / we / they. It drops the obligatory -s that marks he/she/it subjects.
- 📘 Rule: Third-person singular agreement in the Simple Present — see `lecture.md – PHẦN 2: CẤU TRÚC CÂU KHẲNG ĐỊNH` (the "-s/-es/-ies" suffix rules).
- ⚠️ Tip: Whenever the subject can be replaced by "she", "he", or "it", mentally add the -s before choosing. Verbs ending in -ch → add -es (teach → teaches, reach → reaches).

**Q19 — Incorrect**
- Correct answer: `C (Does)`  |  Your answer: `A (Do)`
- ✅ Why it's correct: The subject of the question is "your sister" (= she), a third-person singular noun, so the auxiliary must be "Does".
- ❌ Why yours is wrong: "Do" is the auxiliary for I / you / we / they. Using it with "your sister" creates a subject-auxiliary agreement error.
- 📘 Rule: Yes/No question formation — see `lecture.md – PHẦN 3: CÂU HỎI`. The rule: Do + I/you/we/they; Does + he/she/it/singular noun.
- ⚠️ Tip: The -s travels from the main verb to the auxiliary in questions: "She speaks" → "Does she speak?" (not "Do she speaks?"). One -s, always on the auxiliary in question form.

**Q36 — Correct** ✅ Frequency adverbs like "always" must sit between the subject and a be-verb ("is always"), not before it ("always is") — the learner correctly identified and fixed this.

**Q42 — Partial credit (1/2 pts)**
- Model answer: `My sister wakes up at 5 o'clock every morning because she works far from home.`  |  Your answer: `My sister wake up at 5am because she work far from home.`
- ✅ What you got right: Sentence structure, word order, and overall meaning are correct — a native speaker would understand the sentence.
- ❌ What to fix: Both verbs "wake up" and "work" need the third-person singular -s: "wakes up" and "works". The subject "my sister" = she.
- 📘 Rule: Third-person singular -s applies to ALL verbs in the clause, including phrasal verbs — see `lecture.md – PHẦN 2`.
- ⚠️ Tip: In Section A you conjugated all fill-in-the-blank verbs correctly. Practice spotting the same rule in free writing — write 5 sentences about a family member to build the habit.

**Q20 — Correct** ✅ "The Earth" is a third-person singular subject; "revolves" is the correctly inflected form for a scientific fact stated in the Simple Present.

---

## Common Mistakes (Grader Pitfalls)

1. **Marking a valid `/`-variant as wrong.** If the key says `finishes / ends`, both are correct. Check for parenthetical notes too (`(both acceptable)`).
2. **Giving IELTS writing/speaking an unlabeled band.** Always label writing/speaking bands explicitly as a **self-estimate** — never claim an official score for these sections. Derive the estimate from the descriptor rubric or, where only a checklist exists, from the pass rate of checklist items.
3. **Forgetting the SỔ GHI LỖI and KHUYẾN NGHỊ sections.** Every report must include the error-log table and study recommendations — do not skip them.
4. **Writing explanations in Vietnamese.** The rule: explanation content (the why-clauses, tips, rules) must be in English. Vietnamese is for headings and band labels only.
5. **Using the lesson band table (90/75/60%) for IELTS reading.** IELTS reading uses the raw→band table printed in that specific test's `answer_key.md`, never the percentage cutoffs. Also: never use one test's raw→band table for a different test — each test ships its own conversion table.
6. **Forgetting half-credit for productive items.** Translations worth 2 pts can earn 1 pt when meaning is right but grammar fails (or vice versa). Do not round to 0 or 2.
7. **Editing exercise.md.** Always write output to a NEW `score_report_<date>.md` file in the same folder. Never modify the exercise file.

---

## Quick Reference

| Content type | Exercise file | Answer key location | Scoring scale |
|---|---|---|---|
| Lesson exercise | `phase_*/lesson_*/exercise.md` | Embedded `## ANSWER KEY` in same file | Points + band table |
| Phase exam | `phase_*/exam/phaseN_exam.md` | `phase_*/exam/phaseN_answer_key.md` | Points + band table |
| IELTS test | `ielts_practice_tests/test_NN/{reading,writing,speaking}.md` | `test_NN/answer_key.md` | Band 0–9 only — reading: native raw→band table; writing/speaking: estimated band (self-estimate) + Overall Band |
| TOEIC test | `toeic_practice_tests/test_NN/{listening,reading,speaking,writing}.md` | `test_NN/answer_key.md` | Scaled score only — L&R 5–495 each (total 10–990 only if both present); Speaking/Writing 0–200 each via rubric; Listening not yet available → "chưa thi" |
