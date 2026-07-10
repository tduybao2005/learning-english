// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { EmptyState } from "@/components/EmptyState";

test("render tiêu đề và mô tả, không có CTA khi thiếu ctaHref", () => {
  render(<EmptyState title="Chưa có bài nghe nào" description="Quay lại sau nhé." linkComponent="a" />);
  expect(screen.getByText("Chưa có bài nghe nào")).toBeDefined();
  expect(screen.queryByRole("link")).toBeNull();
});

test("render CTA qua linkComponent khi có đủ ctaHref và ctaLabel", () => {
  render(
    <EmptyState title="Trống" ctaHref="/listening" ctaLabel="Luyện nghe" linkComponent="a" />,
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe("/listening");
});
