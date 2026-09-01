import fs from "fs";
import path from "path";

import { listLessons } from "./parse-lesson";
import { parseVocab } from "./parse-vocab";
import { loadVocabTopics, type VocabTopicRow } from "./parse-vocab-topics";

/**
 * Cổng kiểm tra cho bộ phân loại từ vựng theo chủ đề — cùng vai trò với
 * `scripts/build_index.py --check` ở tầng nội dung.
 *
 * Bốn loại lỗi, tách bạch vì mức nguy hiểm khác nhau:
 * - MISSING: từ có trong `vocabulary.md` nhưng chưa có dòng mapping. Chấp
 *   nhận được trong lúc phân loại dần, nên chỉ báo cáo kèm danh sách.
 * - UNKNOWN_TOPIC / ORPHAN / DUP_TOPIC: hỏng thật, phải bằng 0. ORPHAN
 *   chính là cái bắt drift khi nội dung Markdown đổi mà mapping chưa theo.
 */

export interface TopicCheckFindings {
  missing: string[];
  unknownTopic: { word: string; topicSlug: string }[];
  orphan: string[];
  dupTopic: string[];
}

export function checkVocabTopics({
  contentWords,
  topics,
  mapping,
}: {
  contentWords: Set<string>;
  topics: VocabTopicRow[];
  mapping: Map<string, string>;
}): TopicCheckFindings {
  const normalizedContent = new Set([...contentWords].map((w) => w.trim().toLowerCase()));
  const knownSlugs = new Set(topics.map((t) => t.slug));

  const missing: string[] = [];
  for (const word of normalizedContent) {
    if (!mapping.has(word)) missing.push(word);
  }

  const unknownTopic: { word: string; topicSlug: string }[] = [];
  const orphan: string[] = [];
  for (const [word, topicSlug] of mapping) {
    if (!knownSlugs.has(topicSlug)) unknownTopic.push({ word, topicSlug });
    if (!normalizedContent.has(word)) orphan.push(word);
  }

  const dupTopic: string[] = [];
  const seenSlugs = new Set<string>();
  const seenOrder = new Set<string>();
  for (const t of topics) {
    if (seenSlugs.has(t.slug)) dupTopic.push(`slug trùng: ${t.slug}`);
    seenSlugs.add(t.slug);
    const orderKey = `${t.group}#${t.orderIndex}`;
    if (seenOrder.has(orderKey)) {
      dupTopic.push(`trùng thứ tự hiển thị: ${t.group} #${t.orderIndex} (${t.slug})`);
    }
    seenOrder.add(orderKey);
  }

  missing.sort();
  orphan.sort();
  return { missing, unknownTopic, orphan, dupTopic };
}

/** Quét toàn bộ `vocabulary.md` trong repo, trả về tập từ đã hạ chữ thường. */
export function collectContentWords(repoRoot: string): Set<string> {
  const words = new Set<string>();
  for (const lesson of listLessons(repoRoot)) {
    const vocabPath = path.join(lesson.dir, "vocabulary.md");
    if (!fs.existsSync(vocabPath)) continue;
    for (const row of parseVocab(fs.readFileSync(vocabPath, "utf8"))) {
      const word = row.word.trim().toLowerCase();
      if (word !== "") words.add(word);
    }
  }
  return words;
}

export function runCheck(repoRoot: string): TopicCheckFindings {
  const { topics, mapping } = loadVocabTopics();
  return checkVocabTopics({ contentWords: collectContentWords(repoRoot), topics, mapping });
}

export function formatReport(findings: TopicCheckFindings, totalWords: number): string {
  const classified = totalWords - findings.missing.length;
  const lines = [
    `Từ vựng đã phân loại: ${classified}/${totalWords}`,
    `  MISSING (chưa phân loại): ${findings.missing.length}`,
    `  UNKNOWN_TOPIC: ${findings.unknownTopic.length}`,
    `  ORPHAN (mapping thừa): ${findings.orphan.length}`,
    `  DUP_TOPIC: ${findings.dupTopic.length}`,
  ];
  if (findings.unknownTopic.length > 0) {
    lines.push("", "Chủ đề không tồn tại:");
    for (const u of findings.unknownTopic.slice(0, 20)) {
      lines.push(`  - "${u.word}" → ${u.topicSlug}`);
    }
  }
  if (findings.orphan.length > 0) {
    lines.push("", "Mapping cho từ không còn trong nội dung:");
    for (const w of findings.orphan.slice(0, 20)) lines.push(`  - ${w}`);
  }
  if (findings.dupTopic.length > 0) {
    lines.push("", "Chủ đề bị trùng:");
    for (const d of findings.dupTopic) lines.push(`  - ${d}`);
  }
  if (findings.missing.length > 0) {
    lines.push("", `Từ chưa phân loại (${findings.missing.length}, hiện 30 từ đầu):`);
    lines.push(`  ${findings.missing.slice(0, 30).join(", ")}`);
  }
  return lines.join("\n");
}

// CLI: mặc định báo cáo rồi thoát 0; `--check` thoát 1 nếu có bất kỳ lỗi nào.
if (require.main === module) {
  const repoRoot = path.join(__dirname, "..", "..", "..");
  const strict = process.argv.includes("--check");
  const total = collectContentWords(repoRoot).size;
  const findings = runCheck(repoRoot);
  console.log(formatReport(findings, total));

  const hardFailures =
    findings.unknownTopic.length + findings.orphan.length + findings.dupTopic.length;
  if (strict && (hardFailures > 0 || findings.missing.length > 0)) {
    console.error("\n[check-vocab-topics] FAIL");
    process.exit(1);
  }
  if (hardFailures > 0) {
    console.error("\n[check-vocab-topics] có lỗi nghiêm trọng (xem trên) — cần sửa.");
    process.exit(1);
  }
}
