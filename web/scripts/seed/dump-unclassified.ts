import fs from "fs";
import path from "path";

import { listLessons } from "./parse-lesson";
import { parseVocab } from "./parse-vocab";
import { loadVocabTopics } from "./parse-vocab-topics";

/** Tiện ích tạm: liệt kê từ chưa phân loại kèm ngữ cảnh để gán chủ đề bằng tay. */
const repoRoot = path.join(__dirname, "..", "..", "..");
const { mapping } = loadVocabTopics();

interface Row {
  word: string;
  group: string;
  meaning: string;
  lesson: string;
}

const rows = new Map<string, Row>();
for (const lesson of listLessons(repoRoot)) {
  const vocabPath = path.join(lesson.dir, "vocabulary.md");
  if (!fs.existsSync(vocabPath)) continue;
  for (const row of parseVocab(fs.readFileSync(vocabPath, "utf8"))) {
    const word = row.word.trim().toLowerCase();
    if (word === "" || mapping.has(word) || rows.has(word)) continue;
    rows.set(word, {
      word,
      group: row.groupName ?? "",
      meaning: row.meaningVi ?? "",
      lesson: path.relative(repoRoot, lesson.dir),
    });
  }
}

const out = [...rows.values()];
const filter = process.argv[2];
const selected =
  filter === undefined ? out : out.filter((r) => r.group === filter || r.lesson.includes(filter));

if (process.argv.includes("--groups")) {
  const counts = new Map<string, number>();
  for (const r of out) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
  for (const [g, c] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${c}\t${g}`);
} else {
  for (const r of selected) console.log(`${r.word}\t${r.meaning}\t${r.group}\t${r.lesson}`);
}
