// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ListeningSetCard } from "@/components/ListeningSetCard";

test("render tiêu đề, số câu và thời lượng, dùng linkComponent được truyền vào", () => {
  render(
    <ListeningSetCard
      href="/listening/practice_a2_02"
      title="At the Library"
      questionCount={40}
      durationLabel="8:20"
      linkComponent="a"
    />,
  );
  const link = screen.getByRole("link");
  expect(link.getAttribute("href")).toBe("/listening/practice_a2_02");
  expect(screen.getByText("At the Library")).toBeDefined();
  expect(screen.getByText(/40 câu/)).toBeDefined();
  expect(screen.getByText(/8:20/)).toBeDefined();
});

test("bỏ thời lượng khi không có durationLabel", () => {
  render(
    <ListeningSetCard
      href="/listening/x"
      title="No duration"
      questionCount={10}
      linkComponent="a"
    />,
  );
  expect(screen.getByText("10 câu")).toBeDefined();
});
