/**
 * Sinh file phát âm cho mọi từ trong bảng VocabWord và ghi cột `audioUrl`.
 *
 *   cd web && npm run audio:vocab
 *
 * PHẢI CHẠY LẠI SAU MỖI LẦN SEED: `scripts/seed/ingest.ts` xoá + tạo lại toàn
 * bộ VocabWord của một lesson, nên `audioUrl` về null. Chạy lại script là đủ —
 * file mp3 đã có thì bỏ qua bước TTS, chỉ cột được ghi lại.
 *
 * Yêu cầu: `edge-tts` có trong PATH (pipx install edge-tts).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { db } from "@/lib/db";
import { slugifyWord, vocabAudioPath } from "@/lib/audio/vocab-audio";

const run = promisify(execFile);
const VOICE = "en-US-AriaNeural";
const OUT_DIR = path.join(process.cwd(), "public", "audio", "vocab");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const rows = await db.vocabWord.findMany({ select: { word: true } });
  // Nhiều lesson dùng chung một từ => chỉ một file cho mỗi slug.
  const unique = new Map<string, string>(); // slug -> word (bản gốc, để đọc)
  for (const { word } of rows) {
    const slug = slugifyWord(word);
    if (slug !== "" && !unique.has(slug)) unique.set(slug, word);
  }

  let made = 0;
  let existed = 0;

  for (const [slug, word] of unique) {
    const file = path.join(OUT_DIR, `${slug}.mp3`);
    if (existsSync(file)) {
      existed++;
      continue;
    }
    try {
      await run("edge-tts", ["--voice", VOICE, "--text", word, "--write-media", file]);
      made++;
      console.log(`✓ ${word} -> ${slug}.mp3`);
    } catch (err) {
      // Một từ hỏng không được làm hỏng cả lần chạy: bỏ qua, `audioUrl` giữ
      // null, UI đơn giản là không hiện nút loa cho từ đó.
      console.error(`✗ ${word}: ${(err as Error).message}`);
    }
  }

  // Backfill cột cho MỌI row có file sẵn sàng — kể cả row vừa bị seed ghi lại.
  // Duyệt theo CHUỖI TỪ NGUYÊN VĂN trong DB, không theo `unique` (vốn gom theo
  // slug): "As well as" và "as well as" chung một file nhưng là hai giá trị
  // `word` khác nhau, mà `where: { word }` khớp phân biệt hoa/thường.
  let updated = 0;
  const distinctWords = new Set(rows.map((r) => r.word));
  for (const word of distinctWords) {
    const slug = slugifyWord(word);
    if (slug === "" || !existsSync(path.join(OUT_DIR, `${slug}.mp3`))) continue;
    const res = await db.vocabWord.updateMany({
      where: { word },
      data: { audioUrl: vocabAudioPath(word) },
    });
    updated += res.count;
  }

  console.log(
    `\nFile: ${made} mới, ${existed} đã có. Đã ghi audioUrl cho ${updated}/${rows.length} dòng.`,
  );
  await db.$disconnect();
}

void main();
