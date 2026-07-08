# Học tiếng Anh — Code Export

Code React/Tailwind thật cho các màn hình lõi, khớp với bản design system.
Dùng chung token → mọi shadcn primitive tự đổi theo.

## Cấu trúc

```
web/src/
├── app/
│   ├── globals.css              ← token oklch (light+dark) + keyframes  ★ dán trước tiên
│   └── dashboard/page.tsx       ← timeline giai đoạn + panel (2 cột ở ≥lg)
├── components/
│   ├── ui/button.tsx            ← shadcn Button + variant accent/success
│   ├── lesson-node.tsx          ← node bài học 4 trạng thái (done/unlocked/locked/skipped)
│   ├── exercise-runner.tsx      ← runner MCQ, đủ state (idle/correct/wrong + slot AI)
│   └── vocab/
│       ├── flashcard.tsx        ← thẻ lật 3D
│       ├── quiz.tsx             ← 4 đáp án + streak
│       └── match.tsx            ← ghép cặp 2 cột + đồng hồ
```

## Cài đặt nhanh

1. **globals.css** — thay file `app/globals.css` hiện tại (giữ tên biến shadcn nên các primitive khác tự kế thừa). Nếu chưa có `tw-animate-css`, xoá dòng import đó.
2. **Font** — trong `app/layout.tsx`:
   ```tsx
   import { Be_Vietnam_Pro } from "next/font/google"
   const beVietnam = Be_Vietnam_Pro({
     subsets: ["latin", "vietnamese"],
     weight: ["400","500","600","700","800"],
     variable: "--font-be-vietnam-pro",
   })
   // <html className={beVietnam.variable}> ... <body className="font-sans">
   ```
3. **button.tsx** — đè file shadcn Button. Giờ có `<Button variant="accent">` và `variant="success"`.
4. Các component còn lại đặt đúng đường dẫn ở trên. Chúng giả định alias `@/` và helper `cn` (`@/lib/utils`) chuẩn shadcn.

## Ghi chú

- Dữ liệu đang hard-code làm mẫu (props có default). **Nối vào data thật của bạn qua props — không đổi logic.**
- Tất cả class dùng token: `bg-primary`, `text-success`, `bg-streak-bg`, `border-destructive`… nên đổi theme = đổi biến trong `globals.css`.
- Motion tôn trọng `prefers-reduced-motion` (đã có media query trong globals.css).
- Kèm ảnh chụp 13 màn hình trong thư mục `screens/` để đối chiếu pixel.
