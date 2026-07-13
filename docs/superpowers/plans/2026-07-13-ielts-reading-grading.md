# IELTS Reading — làm bài & chấm bài

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use `- [ ]`.
> **Project rule: run only ONE subagent at a time.** Work on `main`, commit per task.

## Context

Hôm nay `/ielts/[n]` chỉ là markdown đọc-được, cộng một `AnswerKeyAccordion` lộ sẵn
toàn bộ đáp án. Không có ô nhập nào. Người dùng muốn: **làm bài ngay trên trang, bấm
Nộp bài, chấm cả bài, câu nào sai thì hiện đáp án đúng kèm giải thích** — trên cả
điện thoại, máy tính bảng và laptop (thiết kế: `screens/05-ielts.dc.html`, các frame
"Đề 07: đang làm / đã nộp").

**Phạm vi: CHỈ Reading.** Writing/Speaking không có đáp án khách quan — `answer_key.md`
chỉ có "WRITING SELF-ASSESSMENT CHECKLISTS" và model answer, không có gì để máy so.
Listening thì đề còn chưa có file âm thanh. Hai tab đó giữ nguyên dạng đọc.

**Kết quả trả về là band READING (0–9), không phải band tổng của đề** — band tổng cần
đủ 4 kỹ năng. Phải nói rõ trên UI để người học không hiểu nhầm.

## Cổng dữ liệu — ĐÃ CHẠY, đây là kết quả

`scripts/check_ielts_keys.py` (commit `fb27c4a`) đối chiếu từng `answer_key.md` với
`reading.md` của chính nó. Kết quả: **19/30 đề đạt, 11 đề hỏng.**

- **19 đề dùng được:** 02, 03, 04, 07, 08, 12, 13, 14, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29
- **11 đề hỏng:** 01, 05, 06, 09, 10, 11, 15, 16, 17, 19, 30

Kiểu hỏng điển hình (test_01 Q14): `reading.md` hỏi *"chọn tiêu đề đúng, số La Mã i–x"*,
`answer_key.md` trả lời `TRUE` kèm giải thích về cà phê — **key đang trả lời một câu hỏi
không tồn tại trong đề.** Không phải lỗi giao diện; là thiếu đáp án.

**Giới hạn phải nhớ:** script chỉ kiểm tra *hình thức*. Nó KHÔNG bắt được lỗi nội dung —
test_01 Q2 (key ghi `FALSE`, bài đọc nói `TRUE`) là một giá trị TFNG hợp lệ nên lọt lưới.
Vì vậy **"ĐẠT" = đáng để người kiểm, KHÔNG = đã xác minh.** Chấp nhận rủi ro này có ý
thức: 19 đề vẫn tốt hơn hẳn hiện trạng (accordion lộ sẵn đáp án, không chấm gì cả).

**Quyết định của người dùng:** ship 19 đề trước. 11 đề hỏng dò tay dần sau, và khi dò thì
**sửa thẳng vào `answer_key.md`** (không tạo file corrections riêng).

## Tái dùng — ĐỪNG viết lại

| Mảnh | Ở đâu | Ghi chú |
|---|---|---|
| Chấm phía server, đáp án không rời DB | `src/app/api/listening/[slug]/check/route.ts` | **Mẫu chuẩn để sao chép.** Đọc trước tiên. |
| So khớp đáp án | `src/lib/grading/match.ts` → `matchAnswer()` | Trả `{correct, matchType}`; lo hoa/thường, biến thể, fuzzy |
| Chuẩn hoá | `src/lib/grading/normalize.ts` | Dùng cho `AnswerVariant.normalized` |
| raw → band | `src/lib/band.ts` → `rawToBand(raw, table)` | |
| Parse bảng quy đổi từ markdown | `scripts/seed/seed-placement.ts` → `extractBandTable()` | |
| Container câu hỏi | `Section`/`Question`/`AnswerVariant` | Comment ghi *"exactly one FK is set"* — IELTS là FK thứ 4 |
| Khuôn attempt | `ExerciseAttempt`/`AttemptAnswer` | |
| **Render MCQ ra lựa chọn, FILL_BLANK ra ô nhập** | `src/components/runner/QuestionCard.tsx:311,325` | Yêu cầu của người dùng: *"trắc nghiệm thì là trắc nghiệm, ô nhập thì phải là ô nhập"* |
| Giải thích từng câu | cột `Explanation` trong bảng của `answer_key.md` → `Question.keyNote` | Đã có sẵn, không phải sinh ra |

## Ánh xạ dạng câu

Enum `QuestionKind` hiện có phủ hết, miễn sinh `options` đúng:

| Dạng IELTS | `QuestionKind` | `options` |
|---|---|---|
| True/False/Not Given | `MULTIPLE_CHOICE` | TRUE / FALSE / NOT GIVEN |
| Yes/No/Not Given | `MULTIPLE_CHOICE` | YES / NO / NOT GIVEN |
| Matching headings | `MULTIPLE_CHOICE` | i–x, parse từ khối "List of Headings" |
| Matching paragraph | `MULTIPLE_CHOICE` | A–H |
| MCQ | `MULTIPLE_CHOICE` | A–D |
| Summary/sentence completion, short answer | `FILL_BLANK` | `null` → ô nhập |

---

## Task 1: Schema

**Files:** `web/prisma/schema.prisma`, migration mới

- [ ] `IeltsTest`: thêm `readingKeyVerified Boolean @default(false)` + quan hệ `sections Section[]`.
- [ ] `Section`: thêm `ieltsTestId String?` + FK (nhánh thứ 4 của bất biến "exactly one FK is set" — cập nhật comment cho đúng).
- [ ] `IeltsAttempt` (mô phỏng `ExerciseAttempt`): `userId`, `ieltsTestId`, `startedAt`, `submittedAt DateTime?`, `rawScore Int?`, `band Float?`, `answers IeltsAnswer[]`, `@@index([userId, ieltsTestId])`.
- [ ] `IeltsAnswer` (mô phỏng `AttemptAnswer`): `attemptId`, `questionId`, `answerText`, `isCorrect`, `matchType MatchType?`, `@@unique([attemptId, questionId])`.
- [ ] `npm run db:migrate`; `npx tsc --noEmit`. Commit.

## Task 2: Parser (TDD — đây là task rủi ro nhất)

**Files:** `web/scripts/seed/parse-ielts-reading.ts` + `.test.ts`

`scripts/check_ielts_keys.py` đã học được các quái chiêu định dạng — **đọc nó trước, port
sang TS**, đừng phát minh lại. Bốn cái bẫy đã làm tôi phải sửa script 4 lần (11→14→17→19 đề):

1. Header bảng có cả tiếng Anh lẫn tiếng Việt: `| Q | Answer |`, `| Câu | Đoạn | Đáp án | Tiêu đề |`.
   **Bảng matching-heading để đáp án ở cột 3, không phải cột 2.** Lấy nhầm cột → đề đúng bị báo sai.
2. Số câu có khi in đậm: `| **1** |`.
3. Có đề dùng **danh sách đánh số** thay vì bảng (`1. TRUE`).
4. Marker nhóm câu hỏi không thống nhất: `### Questions 1–5`, `#### Questions 1–6: TFNG`,
   `**Questions 7–10: Complete the sentences...**`.

- [ ] Test trước: fixture từ `test_07` (bảng Anh), `test_02` (bảng Việt), `test_26` (số in đậm), `test_29` (marker `**Questions**`), `test_05` (danh sách).
- [ ] Parse `reading.md` → `{number, prompt, kind, options}`; parse `answer_key.md` → `{number, answer, explanation}`.
- [ ] **Bất biến bắt buộc:** với 19 đề trong danh sách, parser phải ra **đúng 40 câu, mỗi câu có đáp án và dạng hợp lệ**. Viết thành test chạy trên cả 19 đề. Nếu đề nào không đạt → parser sai, sửa parser, KHÔNG hạ chuẩn.
- [ ] `AnswerVariant`: tách biến thể theo `/` (hard rule: *"Variants separated by `/` are all correct"*). `normalized` dùng `normalize()`.
- [ ] Commit.

## Task 3: Seed

**Files:** `web/scripts/seed/seed-ielts.ts`

- [ ] Với mỗi đề trong danh sách 19: parse Reading → tạo `Section`(`ieltsTestId`) + `Question` + `AnswerVariant`. `explanation` → `Question.keyNote`. `answerRaw` giữ nguyên dòng key gốc.
- [ ] Đặt `readingKeyVerified = true` **chỉ** cho 19 đề đó. **Danh sách 19 đề này phải là hằng số tường minh trong code, kèm comment trỏ về `scripts/check_ielts_keys.py`** — không suy ra động lúc chạy.
- [ ] `bandTable` cho từng đề: `extractBandTable()` từ chính `answer_key.md` của đề đó. Lưu vào `IeltsTest` (thêm cột `bandTable Json?`). **Hard rule: không mượn bảng của đề khác.**
- [ ] Chạy `make seed-all`, xác nhận 19 × 40 = 760 `Question` rows.
- [ ] Commit.

## Task 4: API chấm bài

**Files:** `web/src/app/api/ielts/[n]/submit/route.ts` (+ test)

Sao chép mẫu `api/listening/[slug]/check/route.ts`.

- [ ] `POST` nhận `{answers: {questionId, answerText}[]}`. Auth bắt buộc.
- [ ] **Chấm hoàn toàn phía server.** Đáp án KHÔNG BAO GIỜ được gửi xuống client trước khi nộp — mở DevTools là thấy hết. Đây là lý do trang hiện tại (accordion) vô dụng như một bài thi.
- [ ] Từ chối nếu `readingKeyVerified = false` → 409. Trang chưa xác minh không có nút nộp, nhưng API vẫn phải tự bảo vệ.
- [ ] `matchAnswer()` cho từng câu → `IeltsAnswer` rows; `rawScore` = số câu đúng; `band` = `rawToBand(rawScore, test.bandTable)`.
- [ ] Trả về: mỗi câu `{questionId, correct, correctAnswer, explanation}` (chỉ sau khi nộp) + `{rawScore, band}`.
- [ ] Test: nộp toàn đúng → 40/40; nộp toàn sai → 0; đề chưa xác minh → 409; chưa đăng nhập → 401.
- [ ] Commit.

## Task 5: UI trang đề

**Files:** `web/src/app/(app)/ielts/[n]/page.tsx`, component runner mới, `AnswerKeyAccordion` (gỡ khỏi Reading)

Theo frame "Đề 07: đang làm" / "đã nộp" cho **cả 3 khổ màn hình**. Đây là **ngoại lệ duy nhất**
được phép đổi giao diện laptop — người dùng đã chốt.

- [ ] Bỏ dòng `40 câu · 60 phút` ở đầu trang (yêu cầu rõ của người dùng). Giữ mũi tên quay lại + "Đề 07" + tiến độ `?/40`.
- [ ] Reading: giữ bố cục 2 cột (bài đọc | câu hỏi) đã có, nhưng cột câu hỏi render **câu hỏi tương tác** thay vì markdown thuần. MCQ → lựa chọn bấm được; completion/short-answer → ô nhập. Tái dùng `QuestionCard`.
- [ ] Nút **Nộp bài** (sticky ở mobile). Sau khi nộp: mỗi câu hiện ✓/✗; câu sai hiện **đáp án đúng + giải thích**; đầu trang hiện raw score + **band Reading** (ghi rõ "band Reading", không phải band tổng).
- [ ] **Gỡ `AnswerKeyAccordion` khỏi tab Reading** (người dùng: *"đừng tách phần đáp án & giải thích ra nữa"*). Writing/Speaking vẫn giữ accordion — chúng không chấm được, accordion là cách duy nhất xem model answer.
- [ ] 11 đề chưa xác minh (`readingKeyVerified = false`): **giữ nguyên trang như hiện tại** (markdown + accordion), không có nút nộp. Có thể thêm một dòng nhỏ giải thích vì sao.
- [ ] Commit.

## Verification

1. `cd web && npx tsc --noEmit && npm test && npm run lint && npm run build` — xanh.
2. `python3 scripts/check_ielts_keys.py` vẫn ra 19/30 (chưa ai sửa key).
3. Seed xong: 19 đề có 40 câu, 11 đề có 0 câu.
4. Dev server riêng ở port trống (**không rebuild container `web`** — nó phục vụ site thật): làm thử một đề **đã xác minh** → nộp → điểm và giải thích hiện đúng; mở một đề **chưa xác minh** → không có nút nộp, trang như cũ.
5. **Kiểm tra rò rỉ đáp án:** mở Network/DevTools trước khi nộp — payload HTML/JSON của trang **không được chứa đáp án**. Đây là tiêu chí đạt/không đạt của cả tính năng.
6. Playwright 375 / 768 / 1280 đối chiếu với frame "Đề 07".

## Việc để dành (không làm ở plan này)

- Dò tay 11 đề hỏng (~440 câu) và sửa thẳng vào `answer_key.md`. Người dùng đã chốt cách ghi.
- Xác minh nội dung 19 đề "ĐẠT" (~760 câu) — script không bắt được lỗi nội dung.
- AI chấm Writing theo rubric (`src/lib/ai/` đã có sẵn). Độ tin cậy khác hẳn Reading.
