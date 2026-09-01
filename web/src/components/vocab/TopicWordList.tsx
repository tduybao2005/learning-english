"use client";

import { useMemo, useState } from "react";

import { PronounceButton } from "@/components/vocab/PronounceButton";
import { formatIpa } from "@/components/vocab/games";
import type { TopicWord } from "@/lib/vocab-topics";

/**
 * Danh sách từ của một chủ đề. Có ô lọc vì một chủ đề có thể tới hơn 200 từ —
 * cuộn tay qua ngần đó để tìm một từ là không dùng được.
 */
export function TopicWordList({ words }: { words: TopicWord[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return words;
    return words.filter(
      (w) => w.word.toLowerCase().includes(q) || w.meaningVi.toLowerCase().includes(q),
    );
  }, [words, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Danh sách từ</h2>
        <span className="text-caption text-muted-foreground">
          {filtered.length}
          {filtered.length !== words.length && `/${words.length}`} từ
        </span>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm từ hoặc nghĩa..."
        aria-label="Tìm trong chủ đề này"
        className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm transition-colors focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
      />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-caption text-muted-foreground">
          Không có từ nào khớp với “{query}”.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{w.word}</span>
                  {formatIpa(w.ipa) !== "" && (
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {formatIpa(w.ipa)}
                    </span>
                  )}
                </div>
                <p className="truncate text-caption text-muted-foreground">
                  {w.meaningVi !== "" ? w.meaningVi : "(chưa có nghĩa)"}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                GĐ {w.phaseOrder} · Bài {w.lessonOrder}
              </span>
              {w.audioUrl !== null && <PronounceButton src={w.audioUrl} label={w.word} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
