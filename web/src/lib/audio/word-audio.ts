"use client";

/**
 * Phát file phát âm của MỘT từ tiếng Anh.
 *
 * Khác `playSfx`: đây không phải hiệu ứng thưởng/phạt mà là chính nội dung
 * học — trả lời đúng thì thứ đáng nghe là cách đọc của từ, không phải tiếng
 * "ting". Vì vậy nó cắt ngang file đang đọc dở: ghép nhanh sáu cặp phải nghe
 * ra sáu từ nối nhau, mỗi lần đều khớp cặp vừa bấm, chứ không phải một chồng
 * âm chồng lên nhau.
 *
 * Không bao giờ throw — jsdom không có `play()`, và trình duyệt có thể chặn
 * autoplay; cả hai đều không được làm hỏng luồng trả lời câu hỏi.
 */

/** Giữ ĐỒNG BỘ với `VOICE_VERSION` trong `PronounceButton.tsx`. Tăng mỗi khi
 * sinh lại toàn bộ `public/audio/vocab/` (ví dụ đổi giọng đọc): file tĩnh
 * của Next được cache 4 tiếng và không revalidate, tên file lại suy từ chữ
 * của từ nên không đổi được — query string là thứ duy nhất buộc tải lại. */
const VOICE_VERSION = 2;

/** Cache theo `src`: một phiên chạm tối đa vài chục từ, giữ lại để lần phát
 * thứ hai không phải tải lại file. */
const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

export function playWordAudio(src: string | null | undefined): void {
  if (!src) return;
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  try {
    if (current !== null) current.pause();

    let el = cache.get(src);
    if (!el) {
      el = new Audio(`${src}?v=${VOICE_VERSION}`);
      el.preload = "auto";
      cache.set(src, el);
    }

    current = el;
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  } catch {
    /* fail silent */
  }
}

/**
 * Dừng giọng đọc đang chạy.
 *
 * Gọi trước tiếng báo SAI: file phát âm của từ vừa ghép đúng dài cỡ một giây,
 * nên nếu người học ghép sai ngay sau đó thì tiếng "sai" ngắn bị lấp dưới
 * giọng đọc còn dở và nghe như app không phản hồi gì.
 */
export function stopWordAudio(): void {
  if (current === null) return;
  try {
    current.pause();
  } catch {
    /* fail silent */
  }
  current = null;
}

export function __resetWordAudioForTests(): void {
  cache.clear();
  current = null;
}
