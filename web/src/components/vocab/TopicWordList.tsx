"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { PronounceButton } from "@/components/vocab/PronounceButton";
import { formatIpa } from "@/components/vocab/games";
import type { TopicWord, TopicWordStatus } from "@/lib/vocab-topics";

type Filter = "all" | TopicWordStatus;

const STATUS_META: Record<TopicWordStatus, { label: string; dot: string; chip: string }> = {
  new: { label: "Chưa học", dot: "bg-muted-foreground/40", chip: "text-muted-foreground" },
  learning: { label: "Đang học", dot: "bg-streak", chip: "text-streak-foreground" },
  learned: { label: "Đã thuộc", dot: "bg-success", chip: "text-success" },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Chưa học" },
  { value: "learning", label: "Đang học" },
  { value: "learned", label: "Đã thuộc" },
];

/**
 * Danh sách từ của một chủ đề. Có ô tìm và bộ lọc trạng thái vì một chủ đề
 * có thể tới hơn 400 từ — cuộn tay qua ngần đó để tìm những từ chưa thuộc là
 * không dùng được. Nhãn "GĐ x · Bài y" cố ý mờ và nhỏ: từ vựng nay duyệt
 * theo chủ đề, gốc bài chỉ còn là thông tin tra cứu.
 */
export function TopicWordList({ words }: { words: TopicWord[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: words.length, new: 0, learning: 0, learned: 0 };
    for (const w of words) base[w.status] += 1;
    return base;
  }, [words]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (filter !== "all" && w.status !== filter) return false;
      if (q === "") return true;
      return w.word.toLowerCase().includes(q) || w.meaningVi.toLowerCase().includes(q);
    });
  }, [words, query, filter]);

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

      {/* Lưới 4 cột thay vì hàng cuộn ngang: bốn nhãn tiếng Việt kèm số đếm
          luôn tràn khỏi màn hình điện thoại, đẩy "Đã thuộc" ra ngoài mép. */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            data-testid="word-filter"
            onClick={() => setFilter(f.value)}
            className={cn(
              "press-btn flex min-h-9 items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-tight transition-all",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {f.label} {counts[f.value]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-caption text-muted-foreground">
          {query === ""
            ? "Chưa có từ nào ở trạng thái này."
            : `Không có từ nào khớp với “${query}”.`}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((w) => {
            const meta = STATUS_META[w.status];
            return (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn("size-2 shrink-0 rounded-full", meta.dot)}
                  title={meta.label}
                  aria-label={meta.label}
                />
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
                <span className={cn("shrink-0 text-[11px] font-semibold", meta.chip)}>
                  {meta.label}
                </span>
                <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:inline">
                  GĐ {w.phaseOrder}·B{w.lessonOrder}
                </span>
                {w.audioUrl !== null && <PronounceButton src={w.audioUrl} label={w.word} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
