"use client";

import { useRef } from "react";
import { Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (typeof Audio === "undefined") return;
    let el = audioRef.current;
    if (!el) {
      el = new Audio(src);
      audioRef.current = el;
    }
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Phát âm: ${label}`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary",
        className,
      )}
    >
      <Volume2 className="size-5" aria-hidden />
    </button>
  );
}
