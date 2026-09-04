"use client";

import { useRef } from "react";
import { Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Tăng mỗi khi sinh lại toàn bộ `public/audio/vocab/` (ví dụ đổi giọng đọc). */
const VOICE_VERSION = 2; // 2 = en-GB-LibbyNeural (1 = en-US-AriaNeural)

/**
 * Nút loa phát file phát âm của một từ. `src` đến từ `VocabWord.audioUrl` (do
 * `scripts/generate-vocab-audio.ts` ghi) — nơi gọi chịu trách nhiệm KHÔNG render
 * nút này khi `audioUrl` là null.
 *
 * Nút thường nằm BÊN TRONG một vùng bấm khác (thẻ flashcard lật khi bấm), nên
 * phải `stopPropagation` — nếu không, bấm loa sẽ lật thẻ.
 */
export function PronounceButton({
  src,
  label,
  className,
}: {
  src: string;
  /** Từ đang phát — chỉ dùng cho `aria-label`. */
  label: string;
  className?: string;
}) {
  // Cache CÙNG VỚI `src` của nó: Flashcards/QuizGame giữ nguyên instance
  // component này khi sang từ tiếp theo (chỉ prop `src` đổi), nên cache chỉ theo
  // "đã tạo Audio chưa" sẽ phát lại file của từ TRƯỚC.
  const audioRef = useRef<{ src: string; el: HTMLAudioElement } | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (typeof Audio === "undefined") return;
    let cached = audioRef.current;
    if (!cached || cached.src !== src) {
      // `?v=` giống lý do ở `sfx.ts`: file tĩnh được cache 4 tiếng và không
      // revalidate, nên khi ĐỔI GIỌNG (Aria -> Libby) người học vẫn nghe giọng
      // cũ. Tên file không đổi (nó suy từ chữ của từ), nên version phải nằm ở
      // query string. Tăng `VOICE_VERSION` mỗi lần sinh lại toàn bộ audio.
      cached = { src, el: new Audio(`${src}?v=${VOICE_VERSION}`) };
      audioRef.current = cached;
    }
    cached.el.currentTime = 0;
    void cached.el.play()?.catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Phát âm: ${label}`}
      className={cn(
        "press-btn inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-primary active:bg-muted",
        className,
      )}
    >
      <Volume2 className="size-5" aria-hidden />
    </button>
  );
}
