import NextLink from "next/link";

import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      icon="🧭"
      title="Không tìm thấy trang"
      description="Trang bạn tìm không tồn tại hoặc đã được chuyển đi."
      ctaHref="/dashboard"
      ctaLabel="Về lộ trình học"
      linkComponent={NextLink}
    />
  );
}
