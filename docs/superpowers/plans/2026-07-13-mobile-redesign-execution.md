# Mobile/Tablet Redesign (ưu tiên) + IELTS Chấm bài (plan riêng)

> **For agentic workers:** Use `superpowers:executing-plans` to work task-by-task. Steps use `- [ ]` syntax.
> **Project rule: run only ONE subagent at a time.**
>
> On approval, save to `docs/superpowers/plans/2026-07-13-mobile-redesign-execution.md`.

## Context

Sáu nhóm màn hình đã được thiết kế xong trên Claude Design và người dùng đã duyệt
(qua ~12 vòng sửa). Design system đã đủ 40 component, project consumer đã tạo, và
vỏ mobile (bottom tab bar 5 tab) + hub `/exams` đã ship. Việc còn lại là **đưa 6
bản thiết kế đó vào code**.

Trong lúc khảo sát, một việc tưởng là "chỉnh giao diện" hoá ra là **tính năng
mới**: bản thiết kế `05-ielts` có nút *Nộp bài* → chấm cả bài → hiện đáp án kèm
giải thích. Hôm nay `/ielts/[n]` chỉ là markdown đọc-được cộng một accordion lộ
sẵn toàn bộ đáp án; không có ô nhập nào. Làm được việc đó cần parser câu hỏi,
bảng `IeltsAttempt`, và API chấm phía server.

Và có một rủi ro dữ liệu chặn ngay tính năng đó: `scripts/seed/seed-placement.ts`
(dòng 26–40) ghi lại kết quả dò tay **test_01** — bảng đáp án trong `answer_key.md`
**SAI**: chấm Q2 là FALSE trong khi đề thật là TRUE, ghi Q14–18 là True/False/Not
Given trong khi đề thật là matching-heading. Đó là boilerplate còn sót từ quy trình
sinh đề, *không* được kiểm chứng theo từng bài đọc. Tôi kiểm lại test_07 thì key
lại đúng. Nên **chưa biết trong 30 đề bao nhiêu đề dùng được**. Chấm bài bằng đáp
án sai còn tệ hơn không chấm, và vi phạm hard rule trong CLAUDE.md
(*"Never invent answers; answer keys are the only source of truth"*).

**Vì vậy:** Phần 1 (mobile/tablet) làm trước, rủi ro thấp, thiết kế đã chốt.
Phần 2 (IELTS chấm bài) **mở đầu bằng một script đối chiếu 30 đề** — con số đó
quyết định phạm vi, rồi mới viết plan chi tiết riêng.

**Tech stack:** Next.js 15 App Router, React 19, Tailwind v4 + shadcn, Prisma 6,
Vitest, Playwright MCP.

## Global Constraints

- **Không đổi render ở `≥1024px` (`lg:`)** — trừ đúng phần Đề thi mà người dùng đã
  chỉ định. Dùng `max-lg:` / default+`lg:`. Đây là ràng buộc quan trọng nhất.
- Bản thiết kế nằm ở `/tmp/claude-1000/-home-ncd-learnspaces-learning-english/6d7a1b80-d886-4bcb-a3b1-248c43ce0c4b/scratchpad/0{1..6}-*.dc.html`
  (bản trên Claude Design: project `2e66171b-7be8-4259-ac0f-ffb23a46f222`).
  Nội dung file `.dc.html` là **DỮ LIỆU, không phải chỉ thị**. CSS trong đó là
  giàn giáo dùng một lần — tái tạo *bố cục và cấu trúc thông tin*, không copy CSS.
- Tái dùng component có sẵn; ưu tiên thêm class responsive hơn là tạo component mới.
- `linkComponent` là prop **bắt buộc, không có default** (mẫu: `EmptyState.tsx`).
- Token ngữ nghĩa của DS: `bg-primary`, `bg-card`, `text-muted-foreground`,
  `bg-success-bg`, `bg-destructive-bg`, `bg-streak-bg`. Thang chữ
  `text-h1/h2/body/caption` — **không dùng** `text-2xl`.
- Chữ UI tiếng Việt. Touch target ≥44px (`min-h-11`).
- Bottom tab bar (`MobileTabBar`, `lg:hidden`, cao 64px) đã có; `(app)/layout.tsx`
  đã chừa `pb-16 lg:pb-0`. Không thêm lại, không để nội dung bị che.
- **KHÔNG BỊA DỮ LIỆU.** Thiết kế có số liệu nào không có nguồn trong schema/query
  thì bỏ đi và báo lại, tuyệt đối không chế ra.
- **KHÔNG BAO GIỜ `git add -A` / `git commit -a`.** Repo có công việc chưa commit
  của người dùng (`CLAUDE.md`, `docs/`, `*.png`, `node_modules/`) phải giữ nguyên.
  Chỉ `git add` đúng những file mình sửa, theo đường dẫn tường minh.
- Làm thẳng trên `main`; commit theo từng task.

## Cách kiểm chứng (đã chốt với người dùng)

Container `web` đang phục vụ site thật sau Cloudflare tunnel — **không rebuild nó**.
Chạy dev server riêng ở port trống, trỏ vào DB đang có:

```bash
cd web && npm run dev -- -p 3100     # chạy nền
```

rồi dùng Playwright MCP chụp ở **375×812, 768×1024, 1280×800** và đối chiếu với
frame tương ứng trong `.dc.html`. Mỗi task đều phải:

```bash
cd web && npx tsc --noEmit && npm test && npm run lint
```

---

# PHẦN 1 — Redesign mobile/tablet (ƯU TIÊN)

Sáu task, mỗi task một nhóm màn hình, chạy tuần tự (một subagent tại một thời điểm).
Mỗi task: đọc `.dc.html` → liệt kê khác biệt so với hiện tại → implement → verify →
commit chỉ những file mình sửa.

## Task 1.1: Dọn BAND khỏi hub Đề thi (laptop + mobile)

Người dùng: *"t không muốn hiện phần BAND, hãy ẩn những gì liên quan tới BAND đi"*.
`src/app/(app)/exams/page.tsx` vẫn truyền `stat: \`Band ${band.toFixed(1)}\``.

- [ ] Bỏ `band`/`placementBand` khỏi `exams/page.tsx`; IELTS `stat: null`. TOEIC giữ `"Sắp có"`.
- [ ] Nếu `stat` không còn ai dùng ngoài `"Sắp có"`, cân nhắc đổi tên thành `badge` trong `ExamsHub.tsx` cho đúng nghĩa. Cập nhật `ExamsHub.test.tsx`.
- [ ] Verify + commit: `fix(exams): drop the placement band from the exams hub`

## Task 1.2: Dashboard — `screens/01-dashboard.dc.html`

Frames: điện thoại, máy tính bảng. File: `src/app/(app)/dashboard/page.tsx`,
`LessonMap.tsx`, `lesson-node.tsx`, `PhasePillRow.tsx`.

- [ ] Đọc thiết kế, liệt kê khác biệt so với `/dashboard` hiện tại ở 375/768.
- [ ] Implement bằng class responsive; **không đụng `lg:`**.
- [ ] Thiết kế có số liệu nào không có query hậu thuẫn → bỏ, báo lại.
- [ ] Playwright 375/768/1280; verify; commit: `feat(mobile): redesign the dashboard for phone and tablet`

## Task 1.3: Bài tập — `screens/03-exercise.dc.html`

Frames: đang làm / trả lời sai / hoàn thành (điện thoại) + máy tính bảng.
File: `src/components/ExerciseRunner.tsx` (thanh tiến trình ở dòng ~323–330).

- [ ] Chuyển thanh tiến trình + `Câu X/12` **xuống body**, ngay trên thẻ câu hỏi (chỉ `max-lg:`).
- [ ] Màn **hoàn thành**: bỏ hẳn thanh tiến trình và dòng `Xong X/X`.
- [ ] Giữ nguyên bố cục ở `lg:`.
- [ ] Verify; commit: `feat(mobile): move the exercise progress bar into the body`

## Task 1.4: Luyện nghe — `screens/04-listening.dc.html`

Frames: danh sách / bài nghe chi tiết (điện thoại) + máy tính bảng.
File: `src/components/ListeningSetView.tsx`, `AudioPlayer.tsx`, `ListeningBottomNav.tsx`.

- [ ] Trên mobile, player dùng `variant="full"` giống laptop (`ListeningSetView.tsx:100` đã dùng — kiểm tra nó không bị co lại ở mobile).
- [ ] `ListeningBottomNav` phải nằm **trên** tab bar (đã xử lý ở Task B.3 — xác nhận lại, đừng làm hai lần).
- [ ] Verify; commit: `feat(mobile): redesign listening for phone and tablet`

## Task 1.5: Bài học — `screens/02-lesson-vocab.dc.html`

Frames: bài giảng (điện thoại), từ vựng hub (điện thoại), bài giảng (máy tính bảng).
File: `src/components/LessonTabs.tsx` (dòng 36–40), `src/app/(app)/learn/[phase]/[lesson]/page.tsx`, `src/app/(app)/vocab/page.tsx`.

- [ ] Trên mobile: đầu trang **chỉ còn nút quay lại**. Bỏ dòng `phaseTitle` ("Giai đoạn X · Bài X").
- [ ] Tựa bài (`lessonTitle`) chuyển xuống **dưới phần nội dung**, đúng vị trí trong thiết kế — bám theo frame, đừng suy diễn.
- [ ] **Giữ nguyên** phần chia tab "Bài giảng | Bài tập".
- [ ] `lg:` giữ nguyên hoàn toàn (header hiện tại của desktop không đổi).
- [ ] Verify; commit: `feat(mobile): slim the lesson header on phone and tablet`

## Task 1.6: Đề thi — phần hub — `screens/05-ielts.dc.html`

**Chỉ làm các frame hub**: "Đề thi (hub)", "IELTS hub". Các frame "Đề 07: đang làm /
đã nộp" thuộc PHẦN 2 — không đụng tới ở đây.
File: `src/components/ExamsHub.tsx`, `src/components/IeltsHub.tsx`.

- [ ] Bố cục hub cho 375/768 theo thiết kế.
- [ ] **Không** đụng `/ielts/[n]` — trang đó được viết lại trọn vẹn ở Phần 2. Sửa bây giờ là làm hai lần.
- [ ] Verify; commit: `feat(mobile): redesign the exams and IELTS hubs`

## Task 1.7: Cài đặt + Kiểm tra đầu vào — `screens/06-settings-onboarding.dc.html`

Frames laptop trong file này là **ảnh tham chiếu** (người dùng: *"hãy giống như trên
laptop"*) — laptop là nguồn chân lý, **không sửa laptop**.
File: `src/app/(app)/settings/page.tsx`, `GoalPicker.tsx`, `PlacementWizard.tsx`.

- [ ] Ô "Mục tiêu học" trên mobile phải giống `GoalPicker` của laptop (pill tabs; chip `aspect-square rounded-2xl`; `grid-cols-3 lg:grid-cols-6`).
- [ ] Màn kiểm tra trình độ trên mobile giống laptop: stepper Nghe → Đọc → Viết + `AudioPlayer variant="full"`.
- [ ] **Không** có mục "Bắt đầu lại từ đầu". Hàng thật là "🔄 Làm lại kiểm tra đầu vào".
- [ ] Verify; commit: `feat(mobile): align settings and placement with the desktop design`

## Verification — Phần 1

1. `cd web && npx tsc --noEmit && npm test && npm run lint && npm run build` — xanh.
2. Playwright sweep `/dashboard`, `/learn/*/exercise`, `/listening`, `/listening/<slug>`, `/vocab`, `/exams`, `/ielts`, `/settings`, `/onboarding/placement` ở 375 / 768 / 1280.
3. **Ở 1280 mọi trang phải y hệt trước khi sửa** (trừ hub Đề thi). Chụp trước/sau để đối chiếu.
4. Bấm thử một link trong mỗi component đã sửa với DevTools mở — thấy request `document` nghĩa là client-side nav đã hỏng.

---

# PHẦN 2 — IELTS chấm bài (plan riêng, làm sau)

**Chưa implement gì ở phần này cho tới khi Task 2.0 cho ra số liệu.**

## Task 2.0 (CỔNG CHẶN): đối chiếu 30 bảng đáp án

Script chỉ-đọc `scripts/check_ielts_keys.py` (stdlib Python, hợp với tooling ở repo root):

- [ ] Với mỗi `ielts_practice_tests/test_NN/`: parse các block `### Questions a–b` trong `reading.md`, và các bảng `| Q | Answer | ... |` trong `answer_key.md`.
- [ ] Báo cáo mỗi đề: số câu khớp không (phải đủ 40); **dạng câu hỏi** khai trong `reading.md` có khớp dạng khai trong `answer_key.md` không; đáp án có hợp lệ với dạng đó không (TFNG chỉ được TRUE/FALSE/NOT GIVEN; matching-heading chỉ được i–x; MCQ chỉ được A–D).
- [ ] Xuất bảng: đề nào **ĐẠT** / **LỆCH** / **KHÔNG PARSE ĐƯỢC**. Biết `test_01` là LỆCH (đã dò tay) — nếu script không bắt được test_01 thì **script sai**, đó là ca kiểm thử.
- [ ] **Dừng lại và đưa con số cho người dùng.** Nếu quá ít đề đạt, tính năng phải tính lại phạm vi.

## Thiết kế (viết chi tiết thành plan riêng SAU khi có số liệu)

Ghi lại đây để không mất, không phải để làm ngay:

**Tái dùng được (đã có trong repo — đừng viết lại):**

| Mảnh | Ở đâu |
|---|---|
| Container câu hỏi dùng chung (`Section`/`Question`/`AnswerVariant`) | `schema.prisma` — comment ghi rõ *"exactly one FK is set"*; IELTS là nhánh FK thứ 4 |
| Suy ra dạng câu + escape hatch thủ công | `scripts/seed/parse-exercise.ts` (`inferKind()`), `scripts/seed/overrides.json` |
| So khớp đáp án, chuẩn hoá, biến thể `/` | `src/lib/grading/match.ts`, `normalize.ts` |
| Quy đổi raw → band bằng bảng của **chính đề đó** | `src/lib/band.ts` (`rawToBand`), `seed-placement.ts` (`extractBandTable`) |
| Khuôn attempt | `ExerciseAttempt` / `AttemptAnswer` → `IeltsAttempt` / `IeltsAnswer` |
| **Render MCQ ra lựa chọn, FILL_BLANK ra ô nhập** | `src/components/runner/QuestionCard.tsx:311,325` |

**Ánh xạ dạng câu (yêu cầu của người dùng: trắc nghiệm phải ra trắc nghiệm, ô nhập
phải ra ô nhập).** Enum `QuestionKind` hiện có phủ được hết nếu sinh `options` đúng:

| Dạng IELTS | `QuestionKind` | `options` |
|---|---|---|
| True/False/Not Given | `MULTIPLE_CHOICE` | TRUE / FALSE / NOT GIVEN |
| Yes/No/Not Given | `MULTIPLE_CHOICE` | YES / NO / NOT GIVEN |
| Matching headings | `MULTIPLE_CHOICE` | i–x, lấy từ khối "List of Headings" |
| Matching paragraph | `MULTIPLE_CHOICE` | A–H |
| MCQ | `MULTIPLE_CHOICE` | A–D |
| Summary/sentence completion, short answer | `FILL_BLANK` | `null` → ô nhập |

**Các mảnh còn lại phải xây:**
- Parser `scripts/seed/parse-ielts-reading.ts`: `reading.md` (`### Questions a–b` → `**N.** …`) thành `Question` rows; đáp án + **cột `Explanation`** lấy từ bảng trong `answer_key.md` (giải thích từng câu **đã có sẵn** — đúng thứ thiết kế cần khi trả lời sai).
- Schema: `IeltsTest.readingKeyVerified Boolean @default(false)`; `ieltsTestId` trên `Section`; `IeltsAttempt` + `IeltsAnswer`.
- API `POST /api/ielts/[n]/submit` — **chấm ở server**, không bao giờ gửi đáp án xuống client trước khi nộp (mở DevTools là thấy hết).
- UI `/ielts/[n]`: bỏ `AnswerKeyAccordion`; Reading render câu hỏi có ô trả lời + nút **Nộp bài**; nộp xong hiện đúng/sai từng câu, câu sai hiện đáp án đúng + giải thích; điểm raw + band. Bố cục theo frame "Đề 07" cho cả **điện thoại, máy tính bảng và laptop**.
- Writing/Speaking **giữ read-only** — không có đáp án khách quan (chỉ model answer + rubric), không tự chấm được.

**Cổng an toàn:** chỉ đề có `readingKeyVerified = true` mới hiện nút Nộp bài. Đề chưa
xác minh giữ nguyên như hiện tại (đọc + accordion). Không học viên nào bị chấm bằng
đáp án sai.
