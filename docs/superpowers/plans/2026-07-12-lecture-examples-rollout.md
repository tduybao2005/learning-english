# Mở rộng ví dụ tương tác ra toàn bộ bài giảng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) hoặc superpowers:subagent-driven-development để thực thi từng task. Chạy **tối đa 1 subagent tại một thời điểm** (project rule).
>
> Khi bắt đầu thực thi, lưu plan này vào `docs/superpowers/plans/2026-07-12-lecture-examples-rollout.md`.

## Context

Hạ tầng ví dụ tương tác trong bài giảng đã chạy thật (parser `web/src/lib/lecture-examples.ts`, API `POST /api/lessons/[lessonId]/example-check`, component `InlineExample.tsx`, đã kiểm chứng trên trình duyệt). Nhưng nội dung mới chỉ có **5 ví dụ, tất cả nằm trong PHẦN 1 của Bài 1** — PHẦN 2–7 của chính bài đó và 51 bài giảng còn lại chưa có ví dụ nào.

Yêu cầu của người dùng:
- **Mọi phần** trong mỗi bài học đều phải có ví dụ để người học làm (làm hay không là tuỳ họ — không chặn tiến độ).
- **2–3 ví dụ mỗi phần**; phần lý thuyết nhiều trường hợp (ví dụ quy tắc thêm `-s/-es`) phải có **đủ ví dụ phủ hết mọi trường hợp** bài giảng nêu.
- **Câu trong ví dụ bắt buộc phải khác** các câu đã dùng làm minh hoạ trong phần lý thuyết ở trên.

**Quy mô (đã đo):** 52 file `lecture.md`; sau khi loại các bài luận/nói (xem "Bài bị loại") còn **44 bài / ~330 phần nội dung** → khoảng **700–900 ví dụ**.

**Goal:** Mỗi phần nội dung của 44 bài giảng ngữ pháp/từ vựng có ≥ 2 ví dụ tương tác, được một script kiểm tra tự động canh gác.

**Architecture:** Không đụng code app — hạ tầng đã đủ. Việc cần làm là (1) một script Python kiểm tra độ phủ + tính hợp lệ của các khối ```example (chuẩn hoá chất lượng, chống lỗi âm thầm của parser), rồi (2) viết nội dung theo từng phase, **mỗi phase là 1 task, commit theo từng bài, hết phase thì dừng chờ duyệt**.

**Tech Stack:** Python stdlib (theo khuôn `scripts/check_toeic.py` + `scripts/curriculum_lib.py`), unittest trong `scripts/tests/`; nội dung Markdown; Docker Compose để rebuild + seed.

## Global Constraints

- **Không sửa code app, không sửa schema.** Chỉ thêm `scripts/check_examples.py` (+ test) và sửa `lecture.md`.
- **Không sửa `exercise.md`, `vocabulary.md`, đáp án, hay nội dung lý thuyết sẵn có.** Chỉ *chèn thêm* khối ```example.
- Giữ quy ước song ngữ: `hint` tiếng Việt, câu ví dụ tiếng Anh.
- **Câu ví dụ phải là câu mới**, không lặp lại câu minh hoạ trong phần lý thuyết phía trên (script kiểm tra điều này).
- Sau khi sửa nội dung: `python3 scripts/build_index.py`, commit kèm `index/manifest.json` + `docs/STATUS.md`.
- **Muốn thấy trên app phải rebuild image**: nội dung được COPY vào image lúc build → `docker compose up -d --build web` rồi `make seed-all`. Chỉ chạy `make seed-all` sẽ báo "skipped (unchanged)".
- Làm trực tiếp trên `main`. Một subagent tại một thời điểm.
- **Sau mỗi task (mỗi phase): dừng lại, báo cáo, chờ người dùng duyệt** rồi mới sang phase kế.

## Cú pháp và quy tắc viết ví dụ

Khối đặt ngay sau đoạn lý thuyết mà nó củng cố, cách một dòng trống, không nằm trong bảng/blockquote:

```example
id: l01-p2-1
prompt: My father ___ (read) the newspaper every morning.
hint: Ngôi thứ ba số ít → thêm -s.
answer: reads
```

- 4 khoá bắt buộc, mỗi khoá một dòng: `id`, `prompt`, `hint`, `answer`. Sai định dạng → parser **bỏ qua âm thầm**, nên script lint là bắt buộc.
- `id`: `l<NN>-p<phần>-<n>` (ví dụ `l03-p2-1`), **duy nhất trong file**.
- `prompt`: một chỗ trống `___` (≥3 gạch dưới). Câu tiếng Anh **mới**, không trùng câu trong lý thuyết.
- `hint`: gợi ý tiếng Việt, chỉ ra quy tắc — không lộ đáp án.
- `answer`: các biến thể cách nhau bằng ` / ` (ví dụ `doesn't eat / does not eat`). Chấm phân biệt hoa/thường **không** quan trọng (đã normalize), nhưng dấu `/` trong chính đáp án thì không dùng được — tránh đáp án chứa dấu gạch chéo.

**Định mức mỗi phần:** 2 ví dụ là mặc định; **3 ví dụ** cho phần nhiều quy tắc; với phần liệt kê quy tắc (như `-s/-es`: 4 quy tắc + ngoại lệ `have → has`) thì **mỗi quy tắc ít nhất 1 ví dụ** — dùng đủ số ví dụ cần thiết, không bị giới hạn 3.

**Phần được bỏ qua** (không cần ví dụ, script tự loại theo tiêu đề H2): `GIỚI THIỆU`, `MỤC TIÊU BÀI HỌC`, `TÓM TẮT NHANH`, `TÓM TẮT BÀI HỌC`, `LIÊN KẾT BÀI HỌC`, và mọi H2 chứa `BÀI TẬP` (vốn đã là bài luyện).

**Bài bị loại hoàn toàn** (dạng luận/nói, điền chỗ trống không chấm khách quan được — người dùng đã chốt bỏ hẳn): toàn bộ `phase_5_ielts_prep/` (7 bài) và `phase_4_advanced/lesson_09_academic_essay_writing/`. Danh sách này nằm trong hằng số `SKIP_LESSONS` của script.

---

## Task 1: Script kiểm tra ví dụ (`scripts/check_examples.py`)

**Files:**
- Create: `scripts/check_examples.py`
- Test: `scripts/tests/test_examples.py`

**Interfaces:**
- Consumes: `curriculum_lib.PHASE_DIR_RE`, `LESSON_DIR_RE` (`scripts/curriculum_lib.py`).
- Produces (importable, giống `scripts/check_toeic.py`):
  ```python
  EXAMPLE_FENCE_RE   # ^```example\n(.*?)^``` — mirror của web/src/lib/lecture-examples.ts
  SKIP_H2_RE         # tiêu đề H2 không cần ví dụ
  SKIP_LESSONS       # set[str] các lesson dir bị loại
  def parse_examples(text: str) -> tuple[list[dict], list[str]]   # (examples, errors)
  def check_lecture(text: str, min_per_section: int = 2) -> list[str]  # errors
  def main(argv: list[str]) -> int   # 0 ok, 1 nếu có lỗi; hỗ trợ `--phase N`, `--min N`
  ```

- [ ] **Step 1: Viết test thất bại** vào `scripts/tests/test_examples.py`:

```python
import unittest

from scripts.check_examples import check_lecture, parse_examples

GOOD = """# BÀI 1

## GIỚI THIỆU

Không cần ví dụ ở đây.

## PHẦN 1: CẤU TRÚC

She works here.

```example
id: l01-p1-1
prompt: My brother ___ (work) in a hospital.
hint: Ngôi thứ ba số ít.
answer: works
```

```example
id: l01-p1-2
prompt: The shop ___ (close) at 10 pm.
hint: Chủ ngữ số ít.
answer: closes
```

## TÓM TẮT NHANH

Không cần ví dụ.
"""


class ParseTests(unittest.TestCase):
    def test_parses_well_formed_blocks(self):
        examples, errors = parse_examples(GOOD)
        self.assertEqual([e["id"] for e in examples], ["l01-p1-1", "l01-p1-2"])
        self.assertEqual(errors, [])

    def test_reports_missing_key(self):
        text = "```example\nid: x\nprompt: A ___ b.\nhint: h\n```\n"
        _, errors = parse_examples(text)
        self.assertTrue(any("answer" in e for e in errors))

    def test_reports_unknown_key(self):
        text = "```example\nid: x\nprompt: A ___ b.\nhint: h\nanswer: c\nnote: d\n```\n"
        _, errors = parse_examples(text)
        self.assertTrue(any("note" in e for e in errors))

    def test_reports_missing_blank(self):
        text = "```example\nid: x\nprompt: No blank here.\nhint: h\nanswer: c\n```\n"
        _, errors = parse_examples(text)
        self.assertTrue(any("___" in e for e in errors))

    def test_reports_duplicate_id(self):
        _, errors = parse_examples(GOOD + GOOD)
        self.assertTrue(any("duplicate" in e for e in errors))


class CoverageTests(unittest.TestCase):
    def test_good_lecture_passes(self):
        self.assertEqual(check_lecture(GOOD), [])

    def test_section_with_too_few_examples_fails(self):
        text = GOOD.replace(
            "```example\nid: l01-p1-2\nprompt: The shop ___ (close) at 10 pm.\n"
            "hint: Chủ ngữ số ít.\nanswer: closes\n```\n\n",
            "",
        )
        errors = check_lecture(text)
        self.assertTrue(any("PHẦN 1" in e for e in errors))

    def test_example_reusing_a_lecture_sentence_fails(self):
        text = GOOD.replace(
            "prompt: My brother ___ (work) in a hospital.",
            "prompt: She ___ here.",
        )
        errors = check_lecture(text)
        self.assertTrue(any("trùng câu" in e or "reuses" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy** `python3 -m unittest scripts.tests.test_examples -v` (từ repo root) — FAIL: `ModuleNotFoundError: scripts.check_examples`.

- [ ] **Step 3: Implement** `scripts/check_examples.py`:

```python
#!/usr/bin/env python3
"""Structural quality gate for interactive ```example blocks in lecture.md.

Usage:
  python3 scripts/check_examples.py                 # check every lecture
  python3 scripts/check_examples.py --phase 1       # only phase 1
  python3 scripts/check_examples.py path/to/lecture.md

Exits 1 if any lecture has an error. The web parser
(web/src/lib/lecture-examples.ts) drops malformed blocks SILENTLY, so a
typo would simply make an example vanish from the page — this script is
what makes that loud. Stdlib only; core checks are importable.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from curriculum_lib import LESSON_DIR_RE, PHASE_DIR_RE

# Mirrors EXAMPLE_FENCE_RE / parseFenceBody in web/src/lib/lecture-examples.ts.
EXAMPLE_FENCE_RE = re.compile(r"^```example[ \t]*\n(.*?)^```[ \t]*$", re.MULTILINE | re.DOTALL)
FIELD_RE = re.compile(r"^(id|prompt|hint|answer):\s*(.+)$")
REQUIRED_KEYS = ("id", "prompt", "hint", "answer")
BLANK_RE = re.compile(r"_{3,}")

H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
SKIP_H2_RE = re.compile(
    r"GIỚI THIỆU|MỤC TIÊU BÀI HỌC|TÓM TẮT|LIÊN KẾT BÀI HỌC|BÀI TẬP", re.IGNORECASE
)

# Essay/speaking lectures: a gap-fill answer key can't grade them objectively.
SKIP_LESSONS = {
    "phase_4_advanced/lesson_09_academic_essay_writing",
}
SKIP_PHASES = {5}

MIN_PER_SECTION = 2


def parse_examples(text: str) -> tuple[list[dict], list[str]]:
    """Every ```example block, plus the errors that would make the web parser
    silently drop one."""
    examples: list[dict] = []
    errors: list[str] = []
    seen: set[str] = set()
    for match in EXAMPLE_FENCE_RE.finditer(text):
        body = match.group(1)
        line_no = text[: match.start()].count("\n") + 1
        fields: dict[str, str] = {}
        bad = False
        for raw in body.split("\n"):
            line = raw.strip()
            if not line:
                continue
            m = FIELD_RE.match(line)
            if not m:
                key = line.split(":", 1)[0]
                errors.append(f"line {line_no}: unknown/malformed key '{key}'")
                bad = True
                continue
            fields[m.group(1)] = m.group(2).strip()
        for key in REQUIRED_KEYS:
            if not fields.get(key):
                errors.append(f"line {line_no}: missing required key '{key}'")
                bad = True
        if bad:
            continue
        if not BLANK_RE.search(fields["prompt"]):
            errors.append(f"line {line_no}: prompt has no ___ blank")
            continue
        if fields["id"] in seen:
            errors.append(f"line {line_no}: duplicate id '{fields['id']}'")
            continue
        seen.add(fields["id"])
        fields["line"] = line_no
        fields["start"] = match.start()
        examples.append(fields)
    return examples, errors


def _sentences(text: str) -> set[str]:
    """Normalized English sentences used as illustrations in the prose, so we can
    catch an example that just re-uses one."""
    prose = EXAMPLE_FENCE_RE.sub("", text)
    out = set()
    for line in prose.split("\n"):
        clean = re.sub(r"[*_`|#-]", " ", line)
        clean = re.sub(r"\([^)]*\)", " ", clean)  # drop Vietnamese glosses
        for part in re.split(r"[.!?]", clean):
            words = re.findall(r"[A-Za-z']+", part)
            if len(words) >= 4:
                out.add(" ".join(w.lower() for w in words))
    return out


def _example_sentence(prompt: str, answer: str) -> str:
    filled = BLANK_RE.sub(answer.split("/")[0].strip(), prompt)
    filled = re.sub(r"\([^)]*\)", " ", filled)
    return " ".join(w.lower() for w in re.findall(r"[A-Za-z']+", filled))


def check_lecture(text: str, min_per_section: int = MIN_PER_SECTION) -> list[str]:
    """Errors for one lecture: malformed blocks, thin sections, recycled sentences."""
    examples, errors = parse_examples(text)

    prose = _sentences(text)
    for ex in examples:
        if _example_sentence(ex["prompt"], ex["answer"]) in prose:
            errors.append(
                f"line {ex['line']}: ví dụ '{ex['id']}' trùng câu đã có trong bài giảng"
            )

    headings = [(m.start(), m.group(1)) for m in H2_RE.finditer(text)]
    for i, (start, title) in enumerate(headings):
        if SKIP_H2_RE.search(title):
            continue
        end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
        count = sum(1 for ex in examples if start < ex["start"] < end)
        if count < min_per_section:
            errors.append(f"section '{title}': {count} ví dụ (cần ≥ {min_per_section})")
    return errors


def _lecture_paths(root: Path, phase: int | None) -> list[Path]:
    paths = []
    for phase_dir in sorted(root.glob("phase_*")):
        pm = PHASE_DIR_RE.match(phase_dir.name)
        if not pm or int(pm.group(1)) in SKIP_PHASES:
            continue
        if phase is not None and int(pm.group(1)) != phase:
            continue
        for lesson_dir in sorted(phase_dir.glob("lesson_*")):
            if not LESSON_DIR_RE.match(lesson_dir.name):
                continue
            rel = f"{phase_dir.name}/{lesson_dir.name}"
            if rel in SKIP_LESSONS:
                continue
            lecture = lesson_dir / "lecture.md"
            if lecture.is_file():
                paths.append(lecture)
    return paths


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="*", type=Path)
    parser.add_argument("--phase", type=int)
    parser.add_argument("--min", type=int, default=MIN_PER_SECTION)
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    paths = args.paths or _lecture_paths(root, args.phase)

    total_errors = 0
    total_examples = 0
    for path in paths:
        text = path.read_text(encoding="utf-8")
        examples, _ = parse_examples(text)
        total_examples += len(examples)
        errors = check_lecture(text, args.min)
        rel = path.relative_to(root) if path.is_absolute() else path
        if errors:
            total_errors += len(errors)
            print(f"\n{rel}")
            for err in errors:
                print(f"  ERROR: {err}")
    print(
        f"\n{len(paths)} lecture(s), {total_examples} example(s), {total_errors} error(s)"
    )
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

Ghi chú import: `scripts/tests/test_toeic.py` import bằng `from scripts.check_toeic import ...`; kiểm tra cách `check_toeic.py` import `curriculum_lib` và làm y hệt (thêm `sys.path` shim nếu file đó có), để `python3 -m unittest discover -s scripts/tests` chạy được.

- [ ] **Step 4: Chạy** `python3 -m unittest scripts.tests.test_examples -v` — 8 test PASS.
- [ ] **Step 5: Chạy trên repo thật** `python3 scripts/check_examples.py --phase 1` — kỳ vọng: báo lỗi "thiếu ví dụ" cho hầu hết các phần (đó chính là công việc của Task 2–5), và **không** báo lỗi định dạng cho 5 ví dụ đã có trong `lesson_01`. Nếu có báo trùng câu / sai định dạng ở `lesson_01` thì sửa ví dụ đó ngay trong task này.
- [ ] **Step 6: Chạy bộ test tooling** `python3 -m unittest discover -s scripts/tests -v` — tất cả xanh.
- [ ] **Step 7: Commit**

```bash
git add scripts/check_examples.py scripts/tests/test_examples.py
git commit -m "feat(scripts): lint interactive lecture examples (format + coverage)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Giai đoạn 1 — 13 bài (~90 phần, ~200 ví dụ)

**Files:** `phase_1_foundation/lesson_01..13_*/lecture.md`, `index/manifest.json`, `docs/STATUS.md`.

Bài và số phần nội dung (đã đo — H2 sau khi loại boilerplate): L01 (6), L02 (6), L03 (5), L04 (8), L05 (8), L06 (8), L07 (10), L08 (7), L09 (6), L10 (6), L11 (6), L12 (7), L13 (5).

**Quy trình cho từng bài** (lặp lại 13 lần, commit sau mỗi bài):

- [ ] **Step 1: Đọc toàn bộ `lecture.md` của bài đó.** Ghi lại: danh sách H2 nội dung, các quy tắc/trường hợp mỗi phần liệt kê, và **mọi câu tiếng Anh đã dùng làm minh hoạ** (để không viết trùng).
- [ ] **Step 2: Chèn ví dụ** sau từng đoạn lý thuyết: ≥2 ví dụ mỗi H2 nội dung; phần liệt kê nhiều quy tắc → ít nhất 1 ví dụ cho **mỗi** quy tắc/trường hợp (ví dụ `-s/-es` của L01: quy tắc 1, 2, 3, 4 và ngoại lệ `have → has`). Với H2 có nhiều H3, rải ví dụ theo từng H3 thay vì dồn cuối phần. Câu mới, `hint` tiếng Việt, `id` theo `l<NN>-p<phần>-<n>`.

  Với phần `LỖI THƯỜNG GẶP`, ra ví dụ dạng **sửa lỗi** vẫn dùng khung điền chỗ trống, ví dụ:
  ```example
  id: l01-p5-1
  prompt: (Sửa lỗi) She doesn't works here. → She ___ here.
  hint: Sau "doesn't" động từ giữ nguyên thể.
  answer: doesn't work / does not work
  ```

- [ ] **Step 3: Lint bài vừa viết**
  `python3 scripts/check_examples.py phase_1_foundation/lesson_NN_*/lecture.md` → `0 error(s)`. Sửa cho tới khi sạch.
- [ ] **Step 4: Commit từng bài**
  ```bash
  git add phase_1_foundation/lesson_NN_*/lecture.md
  git commit -m "content(phase-1/lesson-NN): interactive examples for every section

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

**Kết thúc phase (sau bài thứ 13):**

- [ ] `python3 scripts/check_examples.py --phase 1` → `0 error(s)`.
- [ ] `python3 scripts/build_index.py` → `0 errors`.
- [ ] `docker compose up -d --build web && make seed-all` — log phải có `[seed] updated:` cho các bài phase 1 (nếu thấy `skipped (unchanged)` nghĩa là image chưa rebuild).
- [ ] Mở 2–3 bài trên `https://ielts.tdbao-brian.work/learn/phase_1_foundation/<lesson>` bằng Playwright: mọi phần đều có thẻ "✏️ Thử ngay"; thử 1 câu sai → "Thử lại", 1 câu đúng → "Chính xác!"; kiểm tra payload không chứa `answer:`.
- [ ] Commit `index/manifest.json` + `docs/STATUS.md`.
- [ ] **DỪNG — báo cáo và chờ người dùng duyệt trước khi sang Task 3.**

---

## Task 3: Giai đoạn 2 — 10 bài (~78 phần)

**Files:** `phase_2_elementary/lesson_01..10_*/lecture.md` (+ manifest/STATUS).
Số phần: L01 (7), L02 (8), L03 (6), L04 (10), L05 (7), L06 (10), L07 (8), L08 (10), L09 (4), L10 (8).
Bài nặng quy tắc cần nhiều ví dụ: `lesson_05_articles` (19 H3), `lesson_06_modal_verbs` (27 H3) — mỗi modal/quán từ ít nhất 1 ví dụ.

Lặp lại **đúng quy trình 4 bước của Task 2** cho từng bài (đọc → chèn → lint bài → commit bài), rồi chạy khối "Kết thúc phase" với `--phase 2`, rebuild + seed, kiểm tra trình duyệt, commit manifest, **DỪNG chờ duyệt**.

---

## Task 4: Giai đoạn 3 — 12 bài (~90 phần)

**Files:** `phase_3_intermediate/lesson_01..12_*/lecture.md` (+ manifest/STATUS).
Số phần: L01 (11), L02 (11), L03 (8), L04 (8), L05 (9), L06 (5), L07 (7), L08 (8), L09 (5), L10 (8), L11 (5), L12 (5).
Bài nặng: `lesson_01_passive_voice` (33 H3), `lesson_02_conditionals_type1_2` (35 H3), `lesson_03_conditionals_type3_mixed` (30 H3), `lesson_07_advanced_phrasal_verbs` (43 H3 — mỗi nhóm phrasal verb ít nhất 1 ví dụ), `lesson_10_advanced_comparisons` (24 H3).
Bài từ vựng (`lesson_08_collocations`, `lesson_12_awl_introduction`): ví dụ dạng **chọn từ đúng trong ngữ cảnh** (điền collocation/từ AWL vào chỗ trống), vẫn dùng đúng khung ```example.

Quy trình và khối kết thúc phase giống Task 2 (dùng `--phase 3`). **DỪNG chờ duyệt.**

---

## Task 5: Giai đoạn 4 — 9 bài (~68 phần; bỏ `lesson_09_academic_essay_writing`)

**Files:** `phase_4_advanced/lesson_01..08,10_*/lecture.md` (+ manifest/STATUS).
Số phần: L01 (10), L02 (9), L03 (10), L04 (9), L05 (6), L06 (2), L07 (6), L08 (9), L10 (6).
Bài từ vựng/idiom (`lesson_06_vocabulary_nuances`, `lesson_07_idioms_colloquialisms`, `lesson_10_awl_mastery`): ví dụ chọn từ/idiom đúng trong ngữ cảnh.

Quy trình và khối kết thúc phase giống Task 2 (dùng `--phase 4`).

**Sau khi phase 4 xanh:**
- [ ] `python3 scripts/check_examples.py` (không tham số → toàn bộ 44 bài) → `0 error(s)`.
- [ ] Cân nhắc gắn lint vào cổng kiểm tra chung: thêm một dòng vào `CLAUDE.md` mục Commands (`python3 scripts/check_examples.py  # lint ví dụ trong bài giảng`) và commit.
- [ ] **DỪNG — báo cáo tổng kết** (tổng số ví dụ, số bài, số phần).

---

## Verification (áp dụng cho mọi task)

1. **Lint nội dung:** `python3 scripts/check_examples.py [--phase N]` → `0 error(s)`. Đây là cổng chính: nó bắt được khối sai định dạng (thứ mà app **âm thầm bỏ qua**), id trùng, phần thiếu ví dụ, và ví dụ chép lại câu trong lý thuyết.
2. **Tooling tests:** `python3 -m unittest discover -s scripts/tests -v`.
3. **Index:** `python3 scripts/build_index.py` → `0 errors`.
4. **App thật:** `docker compose up -d --build web && make seed-all`, rồi mở bài trên `https://ielts.tdbao-brian.work/learn/<phase_dir>/<lesson_dir>` bằng Playwright — đếm số ô nhập (`input[aria-label="Câu trả lời"]`) khớp số ví dụ, thử sai→đúng một câu, xác nhận HTML không chứa `answer:` (đáp án không rò rỉ).
5. **Không hồi quy app:** `cd web && npm test` (277 test hiện tại) vẫn xanh — plan này không đụng code app nên chỉ cần chạy một lần ở cuối.

## Critical files

- `scripts/check_examples.py` (mới — cổng chất lượng, mirror `web/src/lib/lecture-examples.ts`)
- `scripts/tests/test_examples.py` (mới)
- `phase_1_foundation/**/lecture.md`, `phase_2_elementary/**/lecture.md`, `phase_3_intermediate/**/lecture.md`, `phase_4_advanced/**/lecture.md` (trừ `lesson_09_academic_essay_writing`) — nội dung
- `index/manifest.json`, `docs/STATUS.md` — regenerate sau mỗi phase

Tái sử dụng: `scripts/curriculum_lib.py` (`PHASE_DIR_RE`, `LESSON_DIR_RE`), khuôn script `scripts/check_toeic.py`, hạ tầng ví dụ đã có (`web/src/lib/lecture-examples.ts`, `InlineExample.tsx`, API `example-check`) — **không sửa gì trong `web/`**.
