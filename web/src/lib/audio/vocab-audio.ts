/**
 * Quy ước ĐẶT TÊN FILE phát âm từ vựng. Chỉ dùng bởi
 * `scripts/generate-vocab-audio.ts` khi sinh file và ghi `VocabWord.audioUrl`.
 * UI đọc `audioUrl` từ DB chứ không suy ra đường dẫn từ chữ — nhờ vậy một từ có
 * thể trỏ tới file phát âm bất kỳ mà không cần đúng quy ước này.
 */
export function slugifyWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu (phòng café/naïve)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function vocabAudioPath(word: string): string {
  return `/audio/vocab/${slugifyWord(word)}.mp3`;
}
