# Prompt mẫu cho Claude Code — Áp dụng Design System "Học tiếng Anh"

> Copy toàn bộ phần dưới (từ dòng `---` đầu tiên) và dán vào Claude Code.
> Kèm theo file `Học tiếng Anh - Design System.dc.html` (mở trong trình duyệt để chụp màn hình các mục làm ảnh tham chiếu — Claude Code bám ảnh tốt hơn bám chữ).

---

## Bối cảnh

Tôi đang áp một bộ nhận diện hình ảnh mới cho ứng dụng **Next.js 15 (App Router) + React 19 + TypeScript**, dùng **Tailwind v4 + shadcn/ui**. Logic & data-fetching đã chạy ổn.

**QUAN TRỌNG: Chỉ đổi phần giao diện/bố cục — KHÔNG động vào data-fetching hay business logic.** Hiện app đang dùng theme mặc định đen-trắng của shadcn.

Hướng thiết kế: **tím-chàm (indigo-violet) làm chủ đạo + san hô ấm (coral) làm điểm nhấn** — cảm giác "học tập/phát triển" nhưng KHÔNG dùng xanh lá chung chung. Khích lệ, hơi vui (gamification cho từ vựng) nhưng vẫn đáng tin, bình tĩnh cho nội dung IELTS. Copy giao diện toàn tiếng Việt; tiếng Anh chỉ nằm trong nội dung bài học.

## 1. Thay token theme trong `app/globals.css`

Giữ nguyên tên biến của shadcn để mọi primitive tự kế thừa:

```css
:root {
  --background: oklch(0.985 0.004 286); --foreground: oklch(0.24 0.02 286);
  --card: oklch(1 0 0); --card-foreground: oklch(0.24 0.02 286);
  --popover: oklch(1 0 0); --popover-foreground: oklch(0.24 0.02 286);
  --muted: oklch(0.965 0.006 286); --muted-foreground: oklch(0.55 0.02 286);
  --border: oklch(0.92 0.008 286); --input: oklch(0.92 0.008 286);
  --primary: oklch(0.55 0.19 274); --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.965 0.006 286); --secondary-foreground: oklch(0.30 0.02 286);
  --accent: oklch(0.68 0.18 29); --accent-foreground: oklch(0.99 0 0);
  --success: oklch(0.66 0.15 150); --success-bg: oklch(0.96 0.04 150);
  --destructive: oklch(0.62 0.16 18); --destructive-bg: oklch(0.96 0.035 18);
  --streak: oklch(0.78 0.15 78); --streak-bg: oklch(0.96 0.05 82);
  --ring: oklch(0.55 0.19 274);
  --radius: 0.625rem; /* 10px */
}
.dark {
  --background: oklch(0.20 0.02 286); --foreground: oklch(0.95 0.006 286);
  --card: oklch(0.245 0.02 286); --card-foreground: oklch(0.95 0.006 286);
  --popover: oklch(0.245 0.02 286); --popover-foreground: oklch(0.95 0.006 286);
  --muted: oklch(0.28 0.02 286); --muted-foreground: oklch(0.68 0.015 286);
  --border: oklch(0.32 0.015 286); --input: oklch(0.34 0.015 286);
  --primary: oklch(0.70 0.15 276); --primary-foreground: oklch(0.18 0.02 286);
  --secondary: oklch(0.28 0.02 286); --secondary-foreground: oklch(0.92 0.006 286);
  --accent: oklch(0.74 0.15 32); --accent-foreground: oklch(0.18 0.02 286);
  --success: oklch(0.72 0.14 152); --success-bg: oklch(0.30 0.05 152);
  --destructive: oklch(0.70 0.14 20); --destructive-bg: oklch(0.30 0.05 20);
  --streak: oklch(0.82 0.14 80); --streak-bg: oklch(0.32 0.05 82);
  --ring: oklch(0.70 0.15 276);
}
```

Đăng ký `success`, `accent`, `streak`, `destructive` trong block `@theme inline` của Tailwind v4 để dùng được `bg-success`, `text-streak`, `bg-accent`…

## 2. Typography

Nạp **Be Vietnam Pro** (400/500/600/700/800) qua `next/font/google`, đặt làm sans mặc định. Thang cỡ: display 44/800, h1 30/700, h2 22/700, body 16/400, caption 13/500. Dấu thanh tiếng Việt phải rõ, không chồng.

## 3. Quy ước

- **Bo góc** cơ sở 10px.
- **Elevation** ám lạnh nhẹ: `shadow-sm` khi nghỉ, `shadow-md` khi hover, CTA có glow primary `shadow-[0_8px_20px_--theme(--color-primary/28%)]`.
- **Khoảng cách** thang 4px.
- **Motion:** 120 / 200 / 320ms, easing `cubic-bezier(.2,.8,.2,1)`. Lật thẻ = rotateY 320ms; đúng = pop 1.14×; sai = shake; progress fill; streak = flame loop. Tôn trọng `prefers-reduced-motion`.
- **A11y:** hit target ≥ 44px, focus ring 4px primary/12%, tương phản WCAG AA cả 2 theme.

## 4. Component cần thêm/chuẩn hoá

- **Button variant `accent`** (`bg-accent text-accent-foreground`) cho hành động thưởng/khởi động.
- **Lesson node** — component dùng chung với 4 trạng thái: `done ✓` / `unlocked ▶` / `locked 🔒` / `skipped ⏭`.

## 5. Restyle màn hình theo bản design tham chiếu

login/verify · onboarding/path · placement wizard + result · dashboard (timeline giai đoạn) · learn reader + exercise runner (MCQ / điền chỗ trống / sai+keyNote+slot AI / đúng / mở khoá) · vocab flashcards/quiz/match · listening · ielts grid · settings · empty/loading states.

Mobile-first; **≥1024px** hiện shell sidebar cố định + dashboard 2 cột.

## Cách làm

Bắt đầu với `globals.css` + font + Button variant + component lesson-node → cho tôi xem diff → rồi dashboard → rồi từng màn hình một. Tôi sẽ dán ảnh chụp bản design để bạn đối chiếu.
