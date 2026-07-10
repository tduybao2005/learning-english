import { EmptyState } from "web";

// `linkComponent="a"` is the design-time link — same markup, no Next navigation.
export const WithCta = () => (
  <div className="w-[28rem]">
    <EmptyState
      icon="🎧"
      title="Chưa có bài nghe nào"
      description="Bắt đầu với bài luyện nghe đầu tiên để mở khoá tiến trình của bạn."
      ctaHref="/listening"
      ctaLabel="Bắt đầu luyện nghe"
      linkComponent="a"
    />
  </div>
);

export const WithoutCta = () => (
  <div className="w-[28rem]">
    <EmptyState
      title="Bạn đã hoàn thành tất cả"
      description="Không còn bài tập nào đang chờ. Quay lại sau nhé!"
      linkComponent="a"
    />
  </div>
);
