# Ghi chú kiến trúc: chẩn đoán placement bằng AI (hệ thống tương lai)

> Đây là **ghi chú thiết kế cho tương lai**, không phải việc cần làm ngay. Nó
> gói lại các quyết định đã thống nhất trong đợt sửa 4 lỗi ngày 2026-07-12
> (xem `2026-07-12-fix-placement-gating-exercise-runner.md`) để lần sau bắt
> tay vào phần AI không phải suy luận lại. Chưa đụng gì tới UI ở giai đoạn này.

## Bối cảnh

Bài kiểm tra đầu vào hiện chấm điểm server-side (Reading + Listening qua
`matchAnswer`), quy ra band IELTS, rồi `startLessonFor(band)` chọn giai đoạn
bắt đầu và `assignStartPoint` mở khoá. **Vẫn cho nhảy band**: thi thật band
cao được xếp thẳng vào giai đoạn phù hợp; các bài trước đó = SKIPPED (vẫn xem
lại được).

## Định hướng tương lai (đã thống nhất với chủ dự án)

1. **Hai luồng người học tách theo band:**
   - **Band thấp (< 4.0 IELTS hoặc mức TOEIC tương ứng):** bắt buộc học lại
     từ Bài 1 — luồng dashboard tuyến tính hiện tại phục vụ đúng nhóm này.
     - ⚠️ **Cần chỉnh khi làm AI:** hiện `startLessonFor` (`web/src/lib/band.ts`)
       cho band `3.5–4.99` vào thẳng `phase_2_elementary`, tức người band
       3.5–3.9 KHÔNG bị ép về Bài 1. Khi triển khai phần này, đổi ngưỡng để
       `band < 4.0 → phase_1_foundation`. (Đợt 2026-07-12 cố ý KHÔNG đổi để
       giữ nguyên hành vi phân band hiện tại.)
   - **Band ≥ 4.0:** không đi theo dashboard tuyến tính. AI sẽ chấm chi tiết
     từng câu trả lời placement, xác định người học đang hổng kiến thức ở
     phần nào (vd ngữ pháp: thì, mạo từ, câu điều kiện…), rồi **sinh roadmap
     riêng** dẫn tới đúng các bài giảng — kể cả ở giai đoạn cao hơn.

2. **Dữ liệu đã sẵn cho AI:** mỗi lần thi lưu `PlacementAttempt.answers`
   dạng `{questionId: {text, isCorrect}}` — được dựng **hoàn toàn server-side**
   (sau khi bịt lỗ hổng tin điểm client). Đây là đầu vào cho bước AI chấm chi
   tiết: map questionId → chủ điểm ngữ pháp/kỹ năng của câu đó, tổng hợp thành
   hồ sơ điểm yếu.

3. **Chỗ mở rộng có sẵn trong schema** (`PlacementAttempt`):
   - `writingBand`, `writingFeedback` — đang để `null`, ghi chú sẵn "FUTURE:
     AI" trong `schema.prisma`. Dùng cho AI chấm phần Viết.
   - Có thể cần thêm bảng/JSON cho "hồ sơ điểm yếu" + "roadmap được sinh".

4. **UI:** roadmap cá nhân hoá cho nhóm band cao sẽ cần giao diện khác hẳn
   dashboard tuyến tính hiện tại. **Chưa giải quyết ở giai đoạn này** — chỉ
   ghi nhận rằng đây là thay đổi cấu trúc lớn sẽ tới.

## Không nằm trong phạm vi đợt 2026-07-12

- Không tích hợp AI.
- Không đổi ngưỡng band của `startLessonFor`.
- Không đổi UI dashboard.
