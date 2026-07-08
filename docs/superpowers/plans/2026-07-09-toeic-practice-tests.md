# 30 Đề TOEIC Practice Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Per repo rule: at most ONE subagent at a time, never parallel.**

**Goal:** Tạo 30 đề TOEIC 4 kỹ năng bám sát format ETS thực tế (Listening tạm để placeholder chờ audio; Reading/Speaking/Writing đầy đủ), tích hợp vào tooling manifest/STATUS và skill chấm điểm hiện có.

**Architecture:** Thư mục mới `toeic_practice_tests/test_01..test_30` song song với `ielts_practice_tests/`, mỗi đề 5 file Markdown có YAML frontmatter. Mở rộng `scripts/curriculum_lib.py` + `build_index.py` + `add_frontmatter.py` để nhận diện TOEIC, cập nhật `docs/content-model.md`, `CLAUDE.md`, và skill `grading-english-exercises`. Nội dung viết theo Test Blueprint cố định (mục dưới) để 30 đề đồng nhất format nhưng khác chủ đề 100%.

**Tech Stack:** Pure Markdown + Python stdlib tooling sẵn có (`scripts/`), unittest.

**Context:** Repo là giáo trình tự học song ngữ Việt–Anh, đã có 30 đề IELTS hoàn chỉnh theo pattern `test_<NN>/{reading,writing,speaking,answer_key}.md`. Người học muốn luyện thêm TOEIC. Repo không có audio nên Listening chỉ tạo file khung (placeholder) — người dùng sẽ bổ sung audio sau; hệ thống chấm điểm vẫn thiết kế đủ 4 kỹ năng ngay từ đầu.

## Global Constraints

- Thư mục: `toeic_practice_tests/test_01` … `test_30` (số 2 chữ số, zero-padded).
- Mỗi đề đúng 5 file: `listening.md` (placeholder có cấu trúc), `reading.md`, `speaking.md`, `writing.md`, `answer_key.md`.
- **Giữ convention song ngữ**: heading/hướng dẫn khung tiếng Việt hoặc song ngữ, toàn bộ nội dung đề + đáp án tiếng Anh. KHÔNG dịch nội dung có sẵn của repo.
- Frontmatter mọi file: `id`, `type` (`toeic_listening|toeic_reading|toeic_speaking|toeic_writing|toeic_answer_key`), `test: <N>`, `cefr: B1-C1`, `title`, `lang: vi-en` — do `scripts/add_frontmatter.py` sinh, không viết tay.
- **Không bao giờ bịa đáp án** — answer_key.md là nguồn sự thật duy nhất; biến thể đúng cách nhau bởi `/`.
- Chấm điểm TOEIC: L&R theo bảng raw→scaled riêng từng đề (Listening 5–495, Reading 5–495, tổng 10–990); Speaking 0–200, Writing 0–200 theo rubric ETS. **Không bao giờ dùng phần trăm, không dùng band IELTS, không mượn bảng đề khác.** Nếu người học chỉ làm L&R thì chỉ báo điểm L&R (hiện tại Listening trống → chỉ chấm Reading 5–495 và ghi rõ "Listening: chưa có audio").
- Sau mỗi lần thêm file nội dung: chạy `python3 scripts/add_frontmatter.py` rồi `python3 scripts/build_index.py`, commit kèm `index/manifest.json` + `docs/STATUS.md`.
- Làm việc trực tiếp trên `main`, commit thường xuyên (mỗi task 1 commit).
- 30 đề không được trùng passage/chủ đề/tình huống với nhau (xem Bảng phân bổ chủ đề).

---

## TEST BLUEPRINT (áp dụng cho MỌI task nội dung 4–33)

Mỗi task đề chỉ khác nhau ở **chủ đề** (tra Bảng phân bổ chủ đề) — cấu trúc, số câu, độ dài, format dưới đây là bắt buộc và giống hệt nhau. Executor của từng task PHẢI đọc blueprint này + tự đọc `toeic_practice_tests/test_01/` (sau khi Task 4 xong) làm mẫu chuẩn.

### `listening.md` — placeholder (~60 dòng, KHÔNG có nội dung câu hỏi)

```markdown
# TOEIC Listening — Test <NN>

> **⏳ CHƯA CÓ NỘI DUNG — chờ bổ sung audio.**
> Phần Listening cần file âm thanh nên tạm để trống. Cấu trúc chuẩn ETS
> bên dưới để giữ chỗ; khi có audio sẽ điền câu hỏi + transcript.

**Time allowed: 45 minutes** — **Total questions: 100 (Q1–100)**

## PART 1: PHOTOGRAPHS (Questions 1–6)
*(Chưa có nội dung — 6 câu mô tả tranh, chọn A–D.)*

## PART 2: QUESTION–RESPONSE (Questions 7–31)
*(Chưa có nội dung — 25 câu hỏi–đáp, chọn A–C.)*

## PART 3: CONVERSATIONS (Questions 32–70)
*(Chưa có nội dung — 13 đoạn hội thoại × 3 câu, chọn A–D.)*

## PART 4: SHORT TALKS (Questions 71–100)
*(Chưa có nội dung — 10 bài nói × 3 câu, chọn A–D.)*
```

### `reading.md` — 100 câu, Q101–200, đúng format ETS 2018+

- Header: `# TOEIC Reading — Test <NN>`, `**Time allowed: 75 minutes**`, `**Total questions: 100 (Q101–200)**`.
- **PART 5: INCOMPLETE SENTENCES (Q101–130)** — 30 câu độc lập, 4 lựa chọn (A)–(D). Trộn đúng tỉ lệ đề thật: ~40% từ loại (word form), ~20% ngữ pháp (thì, mệnh đề quan hệ, giới từ/liên từ), ~40% từ vựng business. Format:
  ```markdown
  **101.** The marketing department ______ its quarterly report by Friday.
  (A) submit (B) submits (C) will submit (D) submitting
  ```
- **PART 6: TEXT COMPLETION (Q131–146)** — 4 văn bản (email, memo, notice, article/letter) × 4 câu; mỗi văn bản có đúng 1 câu "insert a sentence" như đề thật.
- **PART 7: READING COMPREHENSION (Q147–200)** — 54 câu:
  - Single passages Q147–175 (29 câu, ~10 văn bản: text-message chain, advertisement, article, email, notice, web page, form/invoice, letter…);
  - Double passages Q176–185 (2 cặp × 5 câu);
  - Triple passages Q186–200 (3 bộ × 5 câu).
  - Bắt buộc có đủ dạng câu hỏi đề thật: main purpose, detail, inference, vocabulary-in-context ("The word X in paragraph 1, line 2, is closest in meaning to…"), NOT/EXCEPT, sentence-insertion (Part 7 single có ít nhất 1 câu "[1],[2],[3],[4]"), cross-reference (double/triple).
- Mọi văn bản là ngữ cảnh business/đời sống công sở thực tế (đúng chất TOEIC, khác học thuật IELTS). Độ dài toàn file ~900–1100 dòng.

### `speaking.md` — TOEIC Speaking Test, 11 questions, format ETS 2021+

- Header: `# TOEIC Speaking — Test <NN>`, `**Time: ~20 minutes** — **Score: 0–200**`.
- **Q1–2 Read a text aloud** (2 đoạn ~100 từ: quảng cáo/thông báo/hướng dẫn) — kèm `> Gợi ý phát âm:` lưu ý trọng âm/ngắt nghỉ.
- **Q3–4 Describe a picture** — vì repo không có ảnh: mô tả khung cảnh bằng 1 đoạn tiếng Việt trong blockquote `> **[Mô tả tranh]**…`, kèm model answer tiếng Anh ~90 giây.
- **Q5–7 Respond to questions** (chủ đề khảo sát đời sống) — mỗi câu kèm model answer (Q5–6: 15s ~2 câu; Q7: 30s ~4 câu).
- **Q8–10 Respond using information provided** — kèm 1 bảng lịch trình/agenda thật, model answers.
- **Q11 Express an opinion** — kèm model answer ~60 giây (~120 từ).
- Mỗi model answer đặt dưới heading `#### Gợi ý (Model answer)` — nhất quán với convention `Gợi ý` của repo.

### `writing.md` — TOEIC Writing Test, 8 questions, format ETS

- Header: `# TOEIC Writing — Test <NN>`, `**Time: ~60 minutes** — **Score: 0–200**`.
- **Q1–5 Write a sentence based on a picture** — mỗi câu: mô tả tranh bằng blockquote tiếng Việt + 2 từ khóa bắt buộc (`**Keywords: because / late**`) + `#### Gợi ý (Model answer)` 1 câu.
- **Q6–7 Respond to a written request** — mỗi câu 1 email đề bài đầy đủ + yêu cầu ("respond với 2 câu hỏi và 1 đề nghị") + model answer ~80 từ.
- **Q8 Opinion essay** — đề + model essay ~320 từ có mở/thân/kết.

### `answer_key.md` — nguồn sự thật + bảng quy đổi 4 kỹ năng

```markdown
# TOEIC Answer Key — Test <NN>

## PHẦN 1: LISTENING (Q1–100)
> ⏳ Chưa có audio — đáp án Listening sẽ bổ sung cùng lúc với nội dung đề.
> Khi chấm, bỏ qua Listening và ghi "Listening: chưa thi".

## PHẦN 2: READING — ĐÁP ÁN (Q101–200)
### Part 5 (101–130)
101. B — *submits* (chủ ngữ số ít "department"; giải thích 1 dòng cho MỌI câu Part 5–6)
...
### Part 6 (131–146) ...
### Part 7 (147–200)
147. C (Part 7 chỉ cần đáp án + trích dẫn vị trí: "đoạn 2, dòng 3")
...

## PHẦN 3: BẢNG QUY ĐỔI ĐIỂM (riêng đề này — không dùng cho đề khác)
### Listening: raw 0–100 → scaled 5–495   ### Reading: raw 0–100 → scaled 5–495
| Raw | Listening | Reading |
|---|---|---|
| 96–100 | 480–495 | 460–495 |
| 91–95 | 450–475 | 425–455 |
... (bậc 5 câu, xuống tới 0; mỗi đề dao động nhẹ ±5–15 điểm so với đề khác để mô phỏng equating của ETS)

## PHẦN 4: SPEAKING — RUBRIC CHẤM (0–200)
(Bảng tiêu chí ETS theo từng question type: pronunciation, intonation, grammar,
vocabulary, cohesion, relevance, completeness — thang proficiency level 1–8
→ scaled 0–200; checklist tự đánh giá đối chiếu model answers.)

## PHẦN 5: WRITING — RUBRIC CHẤM (0–200)
(Q1–5: grammar + relevance thang 0–3; Q6–7: thang 0–4; Q8: thang 0–5;
bảng quy đổi tổng raw → scaled 0–200 + checklist tự đánh giá.)
```

### Bảng phân bổ chủ đề (chống trùng lặp giữa 30 đề)

Mỗi task tra đúng hàng của mình. "Ngành" chi phối bối cảnh Part 6–7 + Speaking/Writing.

| Test | Ngành/bối cảnh chính | Part 7 double | Part 7 triple | Writing Q8 essay |
|---|---|---|---|---|
| 01 | Marketing & advertising agency | job ad + application email | conference: invite + agenda + hotel booking | remote work pros/cons |
| 02 | Hotel & hospitality | reservation + complaint reply | renovation: notice + schedule + invoice | customer service importance |
| 03 | Logistics & shipping | tracking notice + inquiry | supplier: catalog + order + delivery confirm | teamwork vs individual work |
| 04 | IT & software company | product release + review | training: announcement + signup + feedback survey | technology in education |
| 05 | Retail & e-commerce | promotion flyer + return policy email | store opening: press release + map + coupon | online vs in-store shopping |
| 06 | Healthcare administration | clinic notice + appointment email | health fair: poster + schedule + registration | work-life balance |
| 07 | Banking & finance | account notice + customer inquiry | seminar: brochure + itinerary + expense form | saving vs spending |
| 08 | Real estate & property | listing ad + viewing request | office lease: contract summary + floor plan note + email | city vs countryside living |
| 09 | Manufacturing | safety memo + incident report | factory tour: invitation + checklist + thank-you letter | automation and jobs |
| 10 | Airlines & travel | flight change notice + rebooking email | package tour: ad + itinerary + review | travel benefits |
| 11 | Publishing & media | subscription offer + cancellation | book launch: press release + interview schedule + order form | reading print vs digital |
| 12 | Food service & restaurants | menu update + catering inquiry | food festival: flyer + vendor rules + application | eating out vs cooking |
| 13 | Human resources | policy memo + employee question | recruitment: job fair notice + booth map + follow-up email | job satisfaction factors |
| 14 | Construction & engineering | project update + delay explanation | bid: RFP summary + proposal + clarification email | infrastructure investment |
| 15 | Education & training services | course ad + enrollment email | workshop: program + speaker bio + evaluation form | lifelong learning |
| 16 | Energy & utilities | outage notice + billing inquiry | efficiency audit: letter + report summary + rebate form | renewable energy adoption |
| 17 | Automotive | recall notice + service booking | car show: ad + exhibitor list + pass request | public transport vs private car |
| 18 | Telecommunications | plan upgrade offer + support chat | network upgrade: notice + FAQ + technician schedule | smartphone dependence |
| 19 | Pharmaceuticals | product info + pharmacy query | trial: recruitment ad + consent summary + visit schedule | preventive healthcare |
| 20 | Fashion & apparel | sale announcement + size-exchange email | trade show: invite + booth layout + shipping form | fast fashion impact |
| 21 | Sports & fitness | gym membership offer + freeze request | tournament: rules + bracket + sponsorship letter | exercise habits |
| 22 | Insurance | policy renewal + claim email | agent conference: memo + agenda + travel reimbursement | risk planning |
| 23 | Agriculture & food supply | market report + buyer inquiry | farm expo: flyer + vendor agreement + review | organic food |
| 24 | Museums & culture | exhibit notice + group booking | fundraiser: invitation + donor list note + thank-you | arts funding |
| 25 | Environmental services | recycling memo + resident question | cleanup: volunteer call + roster + supply order | individual vs government env. action |
| 26 | Consulting | proposal cover letter + client reply | offsite: agenda + venue quote + confirmation | leadership qualities |
| 27 | Legal services | appointment letter + document request | CLE seminar: catalog + registration + receipt | ethics in business |
| 28 | Event planning | venue quote + negotiation email | wedding expo: ad + exhibitor kit + inquiry | celebrating milestones |
| 29 | Research & development lab | grant notice + equipment order | symposium: call for papers + program + travel form | funding basic research |
| 30 | Government & public services | permit notice + applicant email | town hall: announcement + minutes + petition summary | civic participation |

Speaking/Writing prompts mỗi đề bám ngành của đề đó (vd Test 02: Q8–10 dùng lịch check-in khách sạn). Part 5 không cần theo ngành nhưng không lặp nguyên câu giữa các đề.

---

## Tasks

### Task 1: Mở rộng tooling nhận diện TOEIC

**Files:**
- Modify: `scripts/curriculum_lib.py`
- Modify: `scripts/build_index.py`
- Modify: `scripts/add_frontmatter.py`
- Test: `scripts/tests/test_toeic.py` (tạo mới; xem pattern test hiện có trong `scripts/tests/`)

**Interfaces:**
- Produces: `curriculum_lib.TOEIC_FILES = ("listening.md", "reading.md", "speaking.md", "writing.md", "answer_key.md")`; `classify()` trả `type: toeic_<stem>` + `test: <N>` + `cefr: "B1-C1"` cho path `toeic_practice_tests/test_<NN>/<f>.md`; `scan_repo()` trả thêm key `"toeic_tests"` (cùng shape với `"ielts_tests"`).

- [ ] **Step 1: Viết failing test**

```python
# scripts/tests/test_toeic.py
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_lib import classify, scan_repo, TOEIC_FILES

class TestToeicClassify(unittest.TestCase):
    def test_toeic_files(self):
        self.assertEqual(TOEIC_FILES,
            ("listening.md", "reading.md", "speaking.md", "writing.md", "answer_key.md"))

    def test_classify_reading(self):
        meta = classify(Path("toeic_practice_tests/test_07/reading.md"))
        self.assertEqual(meta["type"], "toeic_reading")
        self.assertEqual(meta["test"], 7)
        self.assertEqual(meta["cefr"], "B1-C1")
        self.assertEqual(meta["id"], "toeic_practice_tests/test_07/reading")

    def test_classify_score_report(self):
        meta = classify(Path("toeic_practice_tests/test_07/score_report_2026-07-09.md"))
        self.assertEqual(meta["type"], "score_report")

class TestScanRepo(unittest.TestCase):
    def test_scan_includes_toeic(self, ):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            d = root / "toeic_practice_tests" / "test_01"
            d.mkdir(parents=True)
            for f in TOEIC_FILES[:2]:
                (d / f).write_text("# x", encoding="utf-8")
            data = scan_repo(root)
            self.assertEqual(len(data["toeic_tests"]), 1)
            self.assertFalse(data["toeic_tests"][0]["complete"])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy test, xác nhận FAIL** — `python3 -m unittest scripts.tests.test_toeic -v` → ImportError `TOEIC_FILES`.
- [ ] **Step 3: Implement `curriculum_lib.py`**
  - Thêm `TOEIC_FILES = ("listening.md", "reading.md", "speaking.md", "writing.md", "answer_key.md")` cạnh `IELTS_FILES` (dòng 21).
  - Trong `classify()` thêm nhánh sau nhánh `ielts_practice_tests` (dòng 77–89), cùng logic nhưng `top == "toeic_practice_tests"`, `meta["cefr"] = "B1-C1"`, `meta["type"] = "toeic_" + name[:-3]` / `score_report` / `toeic_extra`.
  - Trong `scan_repo()` nhân bản block `tests_root` (dòng 135–149) thành hàm helper `def _scan_tests(root, dirname, files)` dùng chung cho IELTS + TOEIC (DRY), trả về `{"phases": ..., "ielts_tests": ..., "toeic_tests": ...}`.
- [ ] **Step 4: Implement `build_index.py`**
  - `CONTENT_GLOBS` (dòng 25) thêm `"toeic_practice_tests/test_*/*.md"` (cả ở `add_frontmatter.py` dòng 17).
  - `validate()`: lặp `data["toeic_tests"]` như block `ielts_tests` (dòng 56–59), message `incomplete TOEIC test:`. **Ngoại lệ:** `listening.md` placeholder vẫn tính là file tồn tại → không warning.
  - `render_status()`: thêm section `## TOEIC practice tests` sau IELTS, bảng `| Test | listening | reading | speaking | writing | answer key | Score reports |`.
- [ ] **Step 5: Chạy toàn bộ test + check** — `python3 -m unittest discover -s scripts/tests -v` → PASS toàn bộ (test cũ không vỡ); `python3 scripts/build_index.py` (manifest có `"toeic_tests": []`).
- [ ] **Step 6: Commit** — `git add scripts/ index/ docs/STATUS.md && git commit -m "feat(scripts): recognize toeic_practice_tests in tooling"`

### Task 2: Cập nhật docs + grading skill cho TOEIC

**Files:**
- Modify: `docs/content-model.md` (thêm section "TOEIC practice tests" sau section IELTS, mô tả đúng blueprint: 5 file, Q1–100 listening placeholder, Q101–200 reading, bảng quy đổi 5–495×2 riêng từng đề, Speaking/Writing 0–200 rubric)
- Modify: `CLAUDE.md` (mục Layout thêm 1 dòng `toeic_practice_tests/test_<NN>/`; mục Hard rules thêm: "TOEIC L&R chấm theo scaled score 5–495 mỗi kỹ năng bằng bảng quy đổi của chính đề đó — không phần trăm, không band IELTS; Speaking/Writing 0–200 theo rubric trong answer_key.md; Listening chưa có audio → ghi 'chưa thi', không chấm 0.")
- Modify: `.claude/skills/grading-english-exercises/SKILL.md` (thêm locator: TOEIC → `toeic_practice_tests/test_<NN>/answer_key.md`; quy tắc chấm 4 kỹ năng như trên; score report ghi từng kỹ năng riêng + tổng L&R chỉ khi có cả hai)
- Modify: `docs/architecture.md`, `docs/data-flow.md` (mỗi file 1–3 dòng nhắc thư mục mới, theo văn phong sẵn có)

**Interfaces:** Consumes shape `toeic_tests` từ Task 1. Produces: quy tắc chấm mà mọi score report tương lai phải theo.

- [ ] Step 1: Viết các thay đổi docs như liệt kê trên (đọc từng file trước để khớp văn phong).
- [ ] Step 2: `python3 scripts/build_index.py --check` → 0 errors.
- [ ] Step 3: Commit — `git commit -m "docs: document TOEIC test format and grading rules"`

### Task 3: Script kiểm tra chất lượng đề TOEIC

**Files:**
- Create: `scripts/check_toeic.py`
- Test: thêm class `TestCheckToeic` vào `scripts/tests/test_toeic.py`

**Interfaces:** Produces CLI `python3 scripts/check_toeic.py [test_NN ...]` — exit 1 nếu đề sai cấu trúc. Đây là gate chất lượng cho mọi task 4–33.

- [ ] **Step 1: Failing test** — tạo tmp dir chứa 1 đề đúng blueprint tối thiểu + 1 đề thiếu câu, assert exit code/list lỗi.
- [ ] **Step 2: Implement** (stdlib, ~120 dòng). Kiểm tra mỗi `test_NN`:
  - `reading.md`: đủ đánh số `**101.**`…`**200.**` liên tục không trùng/thiếu (regex `^\*\*(\d{3})\.\*\*`); có heading PART 5/6/7.
  - `answer_key.md`: đủ đáp án 101–200 (regex `^(\d{3})\.`); mỗi đáp án ∈ {A,B,C,D}; có heading `BẢNG QUY ĐỔI`; bảng quy đổi có hàng raw phủ 0–100.
  - `speaking.md`: có đủ Q1–Q11; `writing.md`: đủ Q1–Q8; mỗi question có block `Gợi ý`.
  - `listening.md`: có 4 heading PART 1–4 (placeholder hợp lệ).
  - Cảnh báo nếu 2 đề bất kỳ có 1 dòng passage trùng nhau nguyên văn >80 ký tự (chống copy giữa các đề).
- [ ] **Step 3: Test pass** — `python3 -m unittest scripts.tests.test_toeic -v`.
- [ ] **Step 4: Commit** — `git commit -m "feat(scripts): add TOEIC structural checker"`

### Task 4: Đề TOEIC Test 01 (đề mẫu chuẩn — reviewer duyệt kỹ nhất)

**Files:**
- Create: `toeic_practice_tests/test_01/listening.md`, `reading.md`, `speaking.md`, `writing.md`, `answer_key.md`

**Interfaces:** Produces đề mẫu mà mọi task sau đọc làm chuẩn. Consumes: TEST BLUEPRINT + hàng Test 01 của Bảng phân bổ chủ đề (Marketing & advertising agency).

- [ ] Step 1: Viết `listening.md` đúng skeleton placeholder trong blueprint.
- [ ] Step 2: Viết `reading.md` — 100 câu theo blueprint, bối cảnh marketing agency; tự soát: đủ dạng câu hỏi bắt buộc (vocab-in-context, NOT/EXCEPT, sentence insertion, cross-reference).
- [ ] Step 3: Viết `speaking.md` (11 questions + model answers) và `writing.md` (8 questions + models) theo blueprint, chủ đề marketing.
- [ ] Step 4: Viết `answer_key.md` — đáp án khớp 100% với reading.md vừa viết (đối chiếu từng câu, không bịa), bảng quy đổi riêng, rubric Speaking/Writing đầy đủ.
- [ ] Step 5: `python3 scripts/add_frontmatter.py && python3 scripts/check_toeic.py test_01 && python3 scripts/build_index.py` → 0 errors; STATUS.md hiện test_01 đủ 5 file.
- [ ] Step 6: Commit — `git add toeic_practice_tests/test_01 index/ docs/STATUS.md && git commit -m "feat(toeic): add practice test 01 (marketing)"`

### Tasks 5–33: Đề TOEIC Test 02 → Test 30 (29 task, mỗi đề 1 task, TUẦN TỰ)

Mỗi Task N (đề `test_<NN>`, NN = N−3) lặp đúng quy trình Task 4 với khác biệt duy nhất là chủ đề — **bắt buộc tra hàng tương ứng trong Bảng phân bổ chủ đề** và **đọc `toeic_practice_tests/test_01/` làm mẫu format** trước khi viết.

**Files (mỗi task):** Create `toeic_practice_tests/test_<NN>/{listening,reading,speaking,writing,answer_key}.md`

Checklist mỗi task (điền NN):
- [ ] Step 1: Đọc `test_01/` mẫu + hàng chủ đề của đề mình; xác nhận không tái dùng passage/đề bài của các đề đã có (`grep` nhanh cụm từ chính).
- [ ] Step 2: Viết 5 file theo TEST BLUEPRINT với chủ đề được phân bổ.
- [ ] Step 3: Đối chiếu answer_key ↔ reading từng câu (đáp án phải đúng thật, giải thích Part 5–6 đủ 46 dòng).
- [ ] Step 4: `python3 scripts/add_frontmatter.py && python3 scripts/check_toeic.py test_<NN> && python3 scripts/build_index.py` → 0 errors, 0 warnings mới.
- [ ] Step 5: Commit — `git commit -m "feat(toeic): add practice test <NN> (<ngành>)"`

Ví dụ cụ thể: **Task 5** = test_02, Hotel & hospitality, commit `feat(toeic): add practice test 02 (hospitality)` … **Task 33** = test_30, Government & public services.

### Task 34: Tổng kiểm + chốt

**Files:** Modify (nếu lệch): các file phát hiện lỗi; Regenerate: `index/manifest.json`, `docs/STATUS.md`.

- [ ] Step 1: `python3 scripts/check_toeic.py` (cả 30 đề) → 0 errors; kiểm tra cảnh báo trùng passage.
- [ ] Step 2: `python3 -m unittest discover -s scripts/tests -v` → PASS; `python3 scripts/build_index.py --check` → 0 errors.
- [ ] Step 3: Xác nhận `docs/STATUS.md` hiện `30/30 tests complete` cho TOEIC.
- [ ] Step 4: Chấm thử end-to-end: dùng skill `grading-english-exercises` giả lập chấm 5 câu Reading test_01 → score report đúng format scaled score, không sửa file đề (xóa report thử sau khi xác nhận, không commit nó).
- [ ] Step 5: Commit cuối — `git commit -m "chore(toeic): final index regeneration for 30 TOEIC tests"` và push.

## Verification (toàn dự án)

```bash
python3 -m unittest discover -s scripts/tests -v      # tooling PASS
python3 scripts/build_index.py --check                # 0 errors
python3 scripts/check_toeic.py                        # 30/30 đề đạt cấu trúc
grep -c '^\*\*1[0-9][0-9]\.\*\*\|^\*\*200\.\*\*' toeic_practice_tests/test_*/reading.md  # =100/đề
quarto render toeic_practice_tests/test_01/reading.md --to pdf   # render được PDF
```

Chất lượng nội dung (con người duyệt): đối chiếu test_01 với format đề ETS thật (Part 5: 30 câu, Part 6: 16, Part 7: 54; Speaking 11 Q; Writing 8 Q); đáp án ngẫu nhiên 10 câu phải đúng thật.
