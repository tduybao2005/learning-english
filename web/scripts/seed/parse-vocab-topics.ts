import fs from "fs";
import path from "path";

/**
 * Đọc bộ phân loại từ vựng theo chủ đề ở `vocab_topics/` (gốc repo).
 *
 * Cùng một kiểu "file dữ liệu side-car" như `overrides.json`: nội dung trong
 * 51 file `vocabulary.md` giữ nguyên byte-for-byte, phần phân loại nằm riêng
 * để review và sửa từng dòng cho dễ.
 *
 * Khoá tra cứu là CHÍNH TỪ ĐÓ, không phải `lesson_slug + orderIndex`:
 * 3.419 dòng VocabWord chỉ là 2.706 từ khác nhau (482 từ xuất hiện ở nhiều
 * bài, "confirm" có mặt ở 6 bài). Khoá theo từ nên mỗi từ luôn có đúng một
 * chủ đề, và việc chèn/xoá/đảo thứ tự dòng trong Markdown không làm lệch
 * phân loại.
 */

export const TOPIC_GROUPS = ["EVERYDAY", "ACADEMIC", "FUNCTIONAL"] as const;
export type TopicGroup = (typeof TOPIC_GROUPS)[number];

export interface VocabTopicRow {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: TopicGroup;
  orderIndex: number;
}

/** Bỏ dòng trống, dòng chú thích `#`, và dòng tiêu đề cột. */
function dataRows(content: string, headerFirstCell: string): string[][] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells[0] !== headerFirstCell);
}

export function parseTopicsTsv(content: string): VocabTopicRow[] {
  return dataRows(content, "slug").map((cells) => {
    if (cells.length < 6) {
      throw new Error(`topics.tsv: dòng "${cells.join(" | ")}" thiếu cột (cần đủ 6 cột)`);
    }
    const [slug, nameVi, nameEn, emoji, group, orderIndex] = cells;
    if (!TOPIC_GROUPS.includes(group as TopicGroup)) {
      throw new Error(`topics.tsv: nhóm "${group}" không hợp lệ (chỉ nhận ${TOPIC_GROUPS.join("/")})`);
    }
    return {
      slug,
      nameVi,
      nameEn,
      emoji,
      group: group as TopicGroup,
      orderIndex: Number(orderIndex),
    };
  });
}

/** `word` (đã hạ chữ thường, cắt khoảng trắng) → `topic_slug`. */
export function parseMappingTsv(content: string): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const cells of dataRows(content, "word")) {
    if (cells.length < 2) {
      throw new Error(`mapping.tsv: dòng "${cells.join(" | ")}" thiếu cột (cần đủ 2 cột)`);
    }
    const key = cells[0].toLowerCase();
    const topicSlug = cells[1];
    const existing = mapping.get(key);
    if (existing !== undefined && existing !== topicSlug) {
      throw new Error(
        `mapping.tsv: từ "${cells[0]}" bị gán hai chủ đề khác nhau ("${existing}" và "${topicSlug}")`,
      );
    }
    mapping.set(key, topicSlug);
  }
  return mapping;
}

/** Thư mục `vocab_topics/` ở gốc repo, tính từ `web/scripts/seed/`. */
export const VOCAB_TOPICS_DIR = path.join(__dirname, "..", "..", "..", "vocab_topics");

export function loadVocabTopics(dir: string = VOCAB_TOPICS_DIR): {
  topics: VocabTopicRow[];
  mapping: Map<string, string>;
} {
  const topicsPath = path.join(dir, "topics.tsv");
  const mappingPath = path.join(dir, "mapping.tsv");
  const topics = fs.existsSync(topicsPath)
    ? parseTopicsTsv(fs.readFileSync(topicsPath, "utf8"))
    : [];
  const mapping = fs.existsSync(mappingPath)
    ? parseMappingTsv(fs.readFileSync(mappingPath, "utf8"))
    : new Map<string, string>();
  return { topics, mapping };
}
