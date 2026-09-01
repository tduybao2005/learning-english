import { describe, expect, it } from "vitest";

import { checkVocabTopics } from "./check-vocab-topics";
import type { VocabTopicRow } from "./parse-vocab-topics";

function topic(slug: string, orderIndex: number, group: VocabTopicRow["group"]): VocabTopicRow {
  return { slug, nameVi: slug, nameEn: slug, emoji: "🍜", group, orderIndex };
}

const TOPICS = [topic("food-drink", 1, "EVERYDAY"), topic("education", 1, "ACADEMIC")];

describe("checkVocabTopics", () => {
  it("không báo lỗi khi mọi từ đều đã phân loại đúng", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(["rice", "school"]),
      topics: TOPICS,
      mapping: new Map([
        ["rice", "food-drink"],
        ["school", "education"],
      ]),
    });
    expect(findings.missing).toEqual([]);
    expect(findings.unknownTopic).toEqual([]);
    expect(findings.orphan).toEqual([]);
    expect(findings.dupTopic).toEqual([]);
  });

  it("MISSING: liệt kê đúng từ nào chưa được phân loại", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(["rice", "school"]),
      topics: TOPICS,
      mapping: new Map([["rice", "food-drink"]]),
    });
    expect(findings.missing).toEqual(["school"]);
  });

  it("UNKNOWN_TOPIC: bắt mapping trỏ tới chủ đề không tồn tại", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(["rice"]),
      topics: TOPICS,
      mapping: new Map([["rice", "khong-co-that"]]),
    });
    expect(findings.unknownTopic).toEqual([{ word: "rice", topicSlug: "khong-co-that" }]);
  });

  it("ORPHAN: bắt dòng mapping của từ không còn trong nội dung (chống drift)", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(["rice"]),
      topics: TOPICS,
      mapping: new Map([
        ["rice", "food-drink"],
        ["tu-da-bi-xoa", "education"],
      ]),
    });
    expect(findings.orphan).toEqual(["tu-da-bi-xoa"]);
  });

  it("DUP_TOPIC: bắt slug trùng nhau", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(),
      topics: [...TOPICS, topic("food-drink", 9, "EVERYDAY")],
      mapping: new Map(),
    });
    expect(findings.dupTopic.join(" ")).toContain("food-drink");
  });

  it("DUP_TOPIC: bắt trùng cặp (nhóm, thứ tự hiển thị)", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(),
      topics: [...TOPICS, topic("khac", 1, "EVERYDAY")],
      mapping: new Map(),
    });
    expect(findings.dupTopic.join(" ")).toContain("EVERYDAY");
  });

  it("so khớp không phân biệt hoa thường", () => {
    const findings = checkVocabTopics({
      contentWords: new Set(["Rice"]),
      topics: TOPICS,
      mapping: new Map([["rice", "food-drink"]]),
    });
    expect(findings.missing).toEqual([]);
    expect(findings.orphan).toEqual([]);
  });
});
