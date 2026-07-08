# Prompt mẫu cho Claude Code — Web App (Desktop) "Học tiếng Anh"

> Dán phần dưới (từ dòng `---`) vào Claude Code.
> **Quan trọng: kéo-thả trực tiếp các ảnh trong `screens-desktop/` vào khung chat** — Claude Code cần *nhìn* ảnh, không đọc được file `.dc.html` thành giao diện.

Bản đồ ảnh → màn hình:
- `01-d` Đăng nhập (split-screen) · `02-d` Chọn lộ trình · `03-d` Kiểm tra đầu vào · `04-d` Kết quả
- `05-d` Bài giảng · `06-d` Bài tập (runner) · `07-d` Từ vựng (game) · `08-d` Luyện nghe
- `09-d` Đề IELTS · `10-d` Cài đặt

---

## Bối cảnh

Tôi đang áp bộ nhận diện mới cho ứng dụng **Next.js 15 (App Router) + React 19 + TypeScript**, dùng **Tailwind v4 + shadcn/ui**. Logic & data-fetching đã chạy ổn — **chỉ đổi giao diện/bố cục, KHÔNG động vào logic hay data-fetching.**

Đây là pass **desktop (≥1024px)** cho web app. Bản mobile đã có; giờ làm layout màn lớn khớp với các ảnh tôi đính kèm.

Hướng thiết kế: tím-chàm (indigo-violet) chủ đạo + san hô ấm (coral) điểm nhấn. Copy giao diện tiếng Việt; tiếng Anh chỉ trong nội dung bài học.

## Nguyên tắc layout desktop

- **Shell sidebar cố định** bên trái (rộng ~220–236px) cho mọi màn đã đăng nhập: logo trên cùng, nav dọc (Lộ trình · Luyện nghe · Đề IELTS · Từ vựng · Cài đặt), mục đang mở tô nền `bg-primary/10` + chữ primary. Nội dung chính nằm bên phải.
- **Màn xác thực & onboarding** (đăng nhập, chọn lộ trình, kiểm tra đầu vào, kết quả) **KHÔNG có sidebar** — canh giữa. Đăng nhập & kết quả dùng **split-screen**: nửa trái là panel primary (thương hiệu / band cỡ lớn), nửa phải là form / chi tiết.
- **Nội dung đọc** giới hạn bề rộng dễ đọc (~680px). Có thể thêm cột phụ bên phải: mục lục (bài giảng), transcript (luyện nghe), panel streak/việc-hôm-nay (dashboard).
- **Bài tập (runner)** dùng chế độ tập trung, không sidebar: câu hỏi canh giữa; ở trạng thái sai thì đáp án bên trái, keyNote + ô giải thích AI bên phải.
- Tận dụng chiều ngang: lưới đề IELTS 8 cột; chip band onboarding 6 cột; game từ vựng nhiều thẻ cạnh nhau.
- Mọi thứ **responsive**: <1024px thu về 1 cột + bottom nav như bản mobile.

## Token, chữ, component

Dùng đúng token oklch + `@theme inline` + font Be Vietnam Pro + Button variant `accent`/`success` + component `lesson-node` như đã có trong `globals.css` và thư mục `components/` (xem file code kèm theo nếu có). Không tạo màu mới ngoài token.

## Cách làm

Làm từng màn theo thứ tự ảnh (01→10). Mỗi màn: dựng layout desktop khớp ảnh, giữ nguyên data thật qua props, cho tôi xem diff trước khi sang màn kế. **Dùng chính xác màu/khoảng cách/bo góc trong ảnh — không tự sáng tạo.**
