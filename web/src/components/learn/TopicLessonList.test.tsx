// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { TopicLessonList } from "@/components/learn/TopicLessonList";
import type { TopicLesson } from "@/lib/learn-topics";

function lesson(id: string, title: string, status: TopicLesson["status"]): TopicLesson {
  return {
    id,
    slug: `lesson_0${id}_x`,
    phaseSlug: "phase_1_foundation",
    title,
    phaseTitle: "Giai đoạn 1: Nền tảng",
    phaseOrderIndex: 1,
    orderIndex: Number(id),
    wordCount: 12,
    status,
    href: `/learn/phase_1_foundation/lesson_0${id}_x`,
  };
}

const LESSONS = [
  lesson("1", "Thì hiện tại đơn", "done"),
  lesson("2", "Hiện tại tiếp diễn", "learning"),
  lesson("3", "Quá khứ đơn", "new"),
  lesson("4", "Tương lai đơn", "skipped"),
];

test("hiện mọi bài kèm link vào bài — không bài nào bị khoá", () => {
  render(<TopicLessonList lessons={LESSONS} linkComponent="a" />);

  const rows = screen.getAllByTestId("topic-lesson");
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.getAttribute("href")).toContain("/learn/phase_1_foundation/");
  }
});

test("bốn nhãn trạng thái riêng biệt, bỏ qua không phải đã học", () => {
  render(<TopicLessonList lessons={LESSONS} linkComponent="a" />);

  expect(screen.getByText("Đã bỏ qua")).toBeTruthy();
  const labels = screen.getAllByTestId("topic-lesson").map((r) => r.textContent ?? "");
  expect(labels[0]).toContain("Đã học");
  expect(labels[1]).toContain("Đang học");
  expect(labels[2]).toContain("Chưa học");
  expect(labels[3]).toContain("Đã bỏ qua");
});

test("lọc theo trạng thái thu hẹp danh sách", () => {
  render(<TopicLessonList lessons={LESSONS} linkComponent="a" />);

  const chip = screen
    .getAllByTestId("lesson-filter")
    .find((b) => b.textContent?.startsWith("Đã học"))!;
  fireEvent.click(chip);

  expect(screen.getAllByTestId("topic-lesson")).toHaveLength(1);
  expect(screen.getByText("Thì hiện tại đơn")).toBeTruthy();
});

test("lọc ra rỗng thì báo rõ thay vì hiện danh sách trống", () => {
  render(<TopicLessonList lessons={[lesson("1", "Thì hiện tại đơn", "done")]} linkComponent="a" />);

  const chip = screen
    .getAllByTestId("lesson-filter")
    .find((b) => b.textContent?.startsWith("Chưa học"))!;
  fireEvent.click(chip);

  expect(screen.queryAllByTestId("topic-lesson")).toHaveLength(0);
  expect(screen.getByText("Chưa có bài nào ở trạng thái này.")).toBeTruthy();
});
