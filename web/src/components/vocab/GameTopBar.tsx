import Link from "next/link";

/**
 * Thanh đầu trang dùng chung cho ba màn luyện từ vựng.
 *
 * Thay cho khối cũ (link chữ "← Quay lại từ vựng" + một H1 in hoa dài hai
 * dòng lặp lại ở cả ba trang): một nút quay lại dạng icon tròn đạt chuẩn hit
 * target 44px, kèm một nhãn ngữ cảnh ngắn. Tên bài đầy đủ đã có ở trang từ
 * vựng của bài, nhắc lại ở đây chỉ chiếm chỗ của chính phần luyện tập.
 */
export function GameTopBar({
  backHref,
  label,
}: {
  backHref: string;
  /** Nhãn ngữ cảnh ngắn, ví dụ "GĐ 1 · Bài 3 · Thẻ ghi nhớ" hoặc
   *  "🍜 Ăn uống · Quiz". */
  label: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Link
        href={backHref}
        aria-label="Quay lại từ vựng"
        className="press-btn flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:shadow-sm active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <span className="truncate rounded-full bg-muted px-3 py-1.5 text-caption font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
