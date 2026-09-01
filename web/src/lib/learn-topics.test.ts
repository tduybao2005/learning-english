import { expect, test } from "vitest";

import { buildLearnTopics, toLessonStatus, type LessonRow } from "@/lib/learn-topics";
import { LESSON_TOPICS } from "@/lib/lesson-topics";
import type { LessonState } from "@/lib/progress";

function row(phaseSlug: string, slug: string, id: string, orderIndex: number): LessonRow {
  return {
    id,
    slug,
    title: `Bài ${orderIndex}`,
    orderIndex,
    phaseSlug,
    phaseTitle: "Giai đoạn X",
    phaseOrderIndex: 1,
    wordCount: 10,
  };
}

const ROWS: LessonRow[] = [
  row("phase_3_intermediate", "lesson_01_passive_voice", "L1", 1),
  row("phase_4_advanced", "lesson_05_advanced_passive", "L2", 5),
];

test("SKIPPED là trạng thái riêng, KHÔNG phải đã học", () => {
  expect(toLessonStatus("COMPLETED")).toBe("done");
  expect(toLessonStatus("UNLOCKED")).toBe("learning");
  expect(toLessonStatus("SKIPPED")).toBe("skipped");
  expect(toLessonStatus("LOCKED")).toBe("new");
  expect(toLessonStatus(undefined)).toBe("new");
});

test("gom bài vào đúng chủ đề, theo thứ tự học của chủ đề chứ không theo giai đoạn", () => {
  const topics = buildLearnTopics(ROWS, new Map());
  const passive = topics.find((t) => t.slug === "cau-bi-dong");

  expect(passive).toBeDefined();
  expect(passive!.lessons.map((l) => l.id)).toEqual(["L1", "L2"]);
  expect(passive!.total).toBe(2);
});

test("chỉ COMPLETED được tính là đã học — bỏ qua không phải là học xong", () => {
  const states = new Map<string, LessonState>([
    ["L1", "COMPLETED"],
    ["L2", "SKIPPED"],
  ]);

  const passive = buildLearnTopics(ROWS, states).find((t) => t.slug === "cau-bi-dong")!;

  expect(passive.done).toBe(1);
  expect(passive.lessons.map((l) => l.status)).toEqual(["done", "skipped"]);
});

test("đếm riêng số bài đang học", () => {
  const states = new Map<string, LessonState>([["L1", "UNLOCKED"]]);

  const passive = buildLearnTopics(ROWS, states).find((t) => t.slug === "cau-bi-dong")!;

  expect(passive.learning).toBe(1);
  expect(passive.done).toBe(0);
});

test("href trỏ về đúng URL bài học cũ, không đổi đường dẫn", () => {
  const passive = buildLearnTopics(ROWS, new Map()).find((t) => t.slug === "cau-bi-dong")!;

  expect(passive.lessons[0].href).toBe("/learn/phase_3_intermediate/lesson_01_passive_voice");
});

test("trả về đủ mọi chủ đề kể cả khi DB chưa có bài nào", () => {
  const topics = buildLearnTopics([], new Map());

  expect(topics).toHaveLength(LESSON_TOPICS.length);
  expect(topics.every((t) => t.total === 0)).toBe(true);
});

test("bài có trong DB nhưng chưa được xếp chủ đề thì bị bỏ qua, không làm sập", () => {
  const rows = [...ROWS, row("phase_9_unknown", "lesson_99_unknown", "L9", 99)];

  const topics = buildLearnTopics(rows, new Map());

  expect(topics.flatMap((t) => t.lessons).map((l) => l.id)).not.toContain("L9");
});
