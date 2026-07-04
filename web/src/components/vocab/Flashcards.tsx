"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export interface FlashcardWord {
  id: string;
  word: string;
  ipa: string;
  meaningVi: string;
  exampleEn: string;
  groupName: string;
}

interface ReviewResult {
  wordId: string;
  correct: boolean;
}

/**
 * A single-lesson flashcard session: word+IPA front, meaning+example back,
 * flip on tap, then self-report "Đã nhớ ✓ / Chưa nhớ ✗". Results accumulate
 * client-side and are batch-POSTed to `/api/vocab/review` once, at the end of
 * the session — not per-card — so a partially-abandoned session never writes
 * partial Leitner state.
 */
export function Flashcards({ words, backHref }: { words: FlashcardWord[]; backHref: string }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const total = words.length;
  const done = index >= total;
  const card = words[index];

  async function submitResults(finalResults: ReviewResult[]) {
    setSaveState("saving");
    try {
      const res = await fetch("/api/vocab/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ results: finalResults }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  function handleReport(correct: boolean) {
    const next = [...results, { wordId: card.id, correct }];
    setResults(next);
    setFlipped(false);
    setIndex(index + 1);
    if (index + 1 >= total) {
      void submitResults(next);
    }
  }

  function handleRestart() {
    setIndex(0);
    setFlipped(false);
    setResults([]);
    setSaveState("idle");
  }

  if (done) {
    const learnedCount = results.filter((r) => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">Hoàn thành phiên học!</h2>
        <p className="text-muted-foreground">
          Đã nhớ{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{learnedCount}</span>{" "}
          / {total} thẻ · Chưa nhớ{" "}
          <span className="font-medium text-destructive">{total - learnedCount}</span>
        </p>
        {saveState === "saving" && (
          <p className="text-xs text-muted-foreground">Đang lưu tiến độ...</p>
        )}
        {saveState === "saved" && (
          <p className="text-xs text-muted-foreground">Đã lưu tiến độ.</p>
        )}
        {saveState === "error" && (
          <p className="text-xs text-destructive">
            Không thể lưu tiến độ. Vui lòng kiểm tra kết nối và thử lại.
          </p>
        )}
        <div className="mt-3 flex gap-3">
          <Button variant="outline" onClick={handleRestart}>
            Học lại
          </Button>
          <Link href={backHref} className={cn(buttonVariants())}>
            Quay lại từ vựng
          </Link>
        </div>
      </div>
    );
  }

  const percent = Math.round((index / total) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Thẻ {index + 1}/{total}
          </span>
          <span>{card.groupName}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full text-left [perspective:1000px]"
        aria-label={flipped ? "Lật lại mặt trước" : "Nhấn để lật thẻ và xem nghĩa"}
        data-testid="flashcard"
        data-flipped={flipped}
      >
        <div
          className={cn(
            "relative min-h-56 w-full transition-transform duration-500 [transform-style:preserve-3d]",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          {/* Front: word + IPA */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-6 [backface-visibility:hidden]">
            <p className="text-center text-2xl font-bold">{card.word}</p>
            {card.ipa !== "" && <p className="text-muted-foreground">/{card.ipa}/</p>}
            <p className="mt-4 text-xs text-muted-foreground">Nhấn để xem nghĩa</p>
          </div>

          {/* Back: meaning + example */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-lg font-semibold">
              {card.meaningVi !== "" ? card.meaningVi : "(chưa có nghĩa)"}
            </p>
            {card.exampleEn !== "" && (
              <p className="text-sm text-muted-foreground italic">{card.exampleEn}</p>
            )}
          </div>
        </div>
      </button>

      <div className="flex justify-center gap-3">
        <Button variant="destructive" disabled={!flipped} onClick={() => handleReport(false)}>
          Chưa nhớ ✗
        </Button>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-600/80"
          disabled={!flipped}
          onClick={() => handleReport(true)}
        >
          Đã nhớ ✓
        </Button>
      </div>
    </div>
  );
}
