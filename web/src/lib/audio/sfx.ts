"use client";

/** Ba hiệu ứng âm thanh của app. File nằm ở `public/sounds/<name>.mp3`. */
export type SfxName = "correct" | "wrong" | "complete";

/** Cache theo tên: tạo `Audio` một lần rồi tua lại, tránh tải lại file mỗi câu. */
const cache = new Map<SfxName, HTMLAudioElement>();

/**
 * Phát một SFX. Không bao giờ throw: trình duyệt có thể chặn autoplay (chưa có
 * user gesture) hoặc file có thể thiếu — cả hai đều không được làm hỏng luồng
 * trả lời câu hỏi.
 */
export function playSfx(name: SfxName): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  try {
    let el = cache.get(name);
    if (!el) {
      el = new Audio(`/sounds/${name}.mp3`);
      el.preload = "auto";
      // Không hạ volume ở đây: file đã được chuẩn hoá sẵn về -14 LUFS trong
      // `scripts/make-sfx.sh`. Nhân thêm hệ số ở đây từng làm SFX nhỏ tới mức
      // người học không nhận ra là app có phát âm thanh.
      cache.set(name, el);
    }
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  } catch {
    /* fail silent */
  }
}

export function __resetSfxCacheForTests(): void {
  cache.clear();
}
