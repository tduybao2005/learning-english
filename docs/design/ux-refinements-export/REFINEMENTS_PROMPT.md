# Prompt mẫu cho Claude Code — UX Refinements Round 2 "Học tiếng Anh"

> Dán phần dưới (từ dòng `---`) vào Claude Code, kèm file `Học tiếng Anh - UX Refinements.dc.html` mở trong trình duyệt để chụp ảnh 8 mục làm tham chiếu. **Kéo-thả ảnh trực tiếp vào chat** — Claude Code cần *nhìn* ảnh, không đọc file `.dc.html` thành giao diện được.

---

## Bối cảnh

Tinh chỉnh UX (round 2) cho app **Next.js 15 (App Router) + React 19 + TS**, **Tailwind v4 + shadcn/ui**. Logic & data-fetching đã chạy — **chỉ đổi giao diện/bố cục, KHÔNG động vào logic.** Dùng đúng token oklch (indigo-violet + coral), font Be Vietnam Pro, bo góc 10px của hệ thống hiện có. Copy tiếng Việt; tiếng Anh chỉ trong nội dung bài học. Mỗi mục phải chạy tốt ở mobile 375px và desktop 1280px, hỗ trợ cả sáng/tối, hit target ≥44px, focus ring rõ.

## 8 mục cần sửa

1. **Exercise runner — cân lại bố cục.** Gộp kicker · thẻ câu hỏi · phản hồi · nút thành MỘT cột canh giữa (~720px). Nút "Kiểm tra" nằm trong footer thẻ (không trôi ra góc phải). Phản hồi sai trượt xuống ngay dưới thẻ. Đủ 4 trạng thái: chưa chọn (disabled) → Kiểm tra → Sai (shake + keyNote + Thử lại) → Đúng (pop + Tiếp tục).

2. **Câu sửa lỗi — CHỈ một ô nhập.** Người học gõ lại CẢ CÂU đúng vào một ô duy nhất. Câu gốc gạch chân (underline wavy) từ nghi vấn để gợi ý; caption "Viết lại cả câu cho đúng". Trạng thái Sai = shake + gợi ý, Đúng = pop + XP. (KHÔNG dùng hai ô Lỗi/Sửa.)

3. **Bài giảng — bỏ tab "Từ vựng".** Còn 2 tab: Bài giảng · Bài tập, gom thành segmented control gọn. Giữ back-link, kicker giai đoạn, tiêu đề bài.

4. **CTA cuối bài giảng.** Vùng kết thúc riêng: divider + câu khích lệ + nút primary "Làm bài tập →" (auto-width canh giữa cột đọc ở desktop, full-width ở mobile). Có hover (glow mạnh) + focus-visible (ring).

5. **Sidebar — bỏ mục "Cài đặt" khỏi nav.** Nav còn 4 mục. Thẻ hồ sơ dưới cùng là lối vào Cài đặt duy nhất: hiện TÊN HIỂN THỊ (không phải email) + dòng band, hiện ⚙ + viền primary khi hover.

6. **Trang chi tiết đề IELTS — một kỹ năng.** Bỏ tab kỹ năng lồng nhau; trang chỉ thuộc MỘT kỹ năng (back-link về hub đúng tab). **KHÔNG hiển thị dòng "kỹ năng khác" ở góc phải** — trang thuộc trọn một kỹ năng. **Nội dung phải bám sát đề IELTS THẬT — cả câu chữ lẫn bố cục text:** rubric chuẩn ("You should spend about 20 minutes on Questions 1–13"), đoạn văn academic chia đoạn A/B/C, đánh số câu liên tục, các dạng câu hỏi thật (TRUE/FALSE/NOT GIVEN, Sentence Completion "Choose ONE WORD ONLY", Matching Headings…). Không rút gọn hay bịa nội dung minh hoạ. Desktop: đoạn văn trái + câu hỏi phải; mobile: đoạn văn rồi câu hỏi xếp dọc. Accordion "Đáp án & giải thích" thu gọn, cảnh báo chỉ mở sau khi tự làm.

7. **Settings — tên hiển thị chỉnh sửa được.** Banner dẫn bằng tên hiển thị, email là dòng phụ. Nút ✏️ → ô nhập inline (1–50 ký tự) + nút Lưu; có đếm ký tự, trạng thái "✓ Đã lưu", lỗi khi để trống. **Giữ đủ các hàng cũ: Mục tiêu học · Làm lại kiểm tra đầu vào · Giao diện tối · và nút Đăng xuất** (hàng destructive ở cuối).

8. **Phase row — xem & mở mọi bài.** Thay cửa sổ trượt 3–4 pill bằng hàng pill CUỘN NGANG, tự căn tới bài hiện tại, mờ mép phải gợi ý còn nữa. Mọi bài đều thấy & bấm được (xong ✓ / hiện tại ▶ nổi bật / khoá 🔒). Kèm nút "Xem tất cả N bài" mở lưới pill wrap để nhìn toàn cảnh. Rail phải (việc hôm nay / tuần này) giữ nguyên.

## Cách làm

Làm từng mục một, cho tôi xem diff trước khi sang mục kế. Dùng CHÍNH XÁC màu/khoảng cách/bo góc trong ảnh — không tự sáng tạo.
