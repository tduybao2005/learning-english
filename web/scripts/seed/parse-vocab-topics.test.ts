import { describe, expect, it } from "vitest";

import { parseTopicsTsv, parseMappingTsv } from "./parse-vocab-topics";

const TOPICS_TSV = [
  "slug\tname_vi\tname_en\temoji\tgroup\torder_index",
  "food-drink\tĂn uống\tFood & Drink\t🍜\tEVERYDAY\t3",
  "education\tGiáo dục\tEducation\t🎓\tACADEMIC\t1",
].join("\n");

describe("parseTopicsTsv", () => {
  it("đọc đủ các cột của một chủ đề", () => {
    const topics = parseTopicsTsv(TOPICS_TSV);
    expect(topics).toEqual([
      {
        slug: "food-drink",
        nameVi: "Ăn uống",
        nameEn: "Food & Drink",
        emoji: "🍜",
        group: "EVERYDAY",
        orderIndex: 3,
      },
      {
        slug: "education",
        nameVi: "Giáo dục",
        nameEn: "Education",
        emoji: "🎓",
        group: "ACADEMIC",
        orderIndex: 1,
      },
    ]);
  });

  it("bỏ qua dòng trống và dòng chú thích", () => {
    const topics = parseTopicsTsv(
      `${TOPICS_TSV}\n\n# đây là chú thích, không phải chủ đề\n   \n`,
    );
    expect(topics).toHaveLength(2);
  });

  it("từ chối dòng thiếu cột thay vì đọc sai lệch", () => {
    expect(() => parseTopicsTsv("slug\tname_vi\n food-drink\tĂn uống")).toThrow(/cột/i);
  });

  it("từ chối nhóm không hợp lệ", () => {
    const bad = "slug\tname_vi\tname_en\temoji\tgroup\torder_index\nx\tX\tX\t🍜\tKHONG_TON_TAI\t1";
    expect(() => parseTopicsTsv(bad)).toThrow(/nhóm/i);
  });
});

describe("parseMappingTsv", () => {
  it("khoá theo từ đã hạ chữ thường và cắt khoảng trắng", () => {
    const mapping = parseMappingTsv(
      ["word\ttopic_slug", "Wake Up\tdaily-routine", "  happiness  \temotions-personality"].join(
        "\n",
      ),
    );
    expect(mapping.get("wake up")).toBe("daily-routine");
    expect(mapping.get("happiness")).toBe("emotions-personality");
  });

  it("bỏ qua dòng trống và chú thích", () => {
    const mapping = parseMappingTsv("word\ttopic_slug\n\n# ghi chú\nwake up\tdaily-routine\n");
    expect(mapping.size).toBe(1);
  });

  it("từ chối khi một từ được gán hai chủ đề khác nhau", () => {
    const dup = "word\ttopic_slug\nwake up\tdaily-routine\nwake up\thealth-body";
    expect(() => parseMappingTsv(dup)).toThrow(/wake up/);
  });

  it("chấp nhận dòng lặp y hệt (cùng từ, cùng chủ đề)", () => {
    const same = "word\ttopic_slug\nwake up\tdaily-routine\nwake up\tdaily-routine";
    expect(parseMappingTsv(same).size).toBe(1);
  });
});
