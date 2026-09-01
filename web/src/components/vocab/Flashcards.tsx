"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PronounceButton } from "@/components/vocab/PronounceButton";
import { SessionSummary } from "@/components/vocab/SessionSummary";

export interface FlashcardWord {
  id: string;
  word: string;
  ipa: string;
  meaningVi: string;
  exampleEn: string;
  groupName: string;
  /** Null khi từ này chưa có file phát âm — khi đó không render nút loa. */
  audioUrl: string | null;
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
export function Flashcards({
  words,
  backHref,
  linkComponent: Link,
}: {
  words: FlashcardWord[];
  backHref: string;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
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
      <SessionSummary
        title="Hoàn thành phiên học!"
        correct={learnedCount}
        total={total}
        extraStats={[{ label: "Chưa nhớ", value: String(total - learnedCount) }]}
        saveState={saveState}
        restartLabel="Học lại"
        onRestart={handleRestart}
        backHref={backHref}
        linkComponent={Link}
      />
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
            className="h-full animate-progress-fill rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* `role="button"` chứ không phải <button>: nút loa nằm bên trong thẻ, mà
          lồng <button> trong <button> là HTML không hợp lệ. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="w-full text-left perspective-flip"
        aria-label={flipped ? "Lật lại mặt trước" : "Nhấn để lật thẻ và xem nghĩa"}
        data-testid="flashcard"
        data-flipped={flipped}
      >
        <div className={cn("relative h-64 lg:h-80 w-full flip-inner", flipped && "flip-inner-flipped")}>
          {/* Front: word + IPA */}
          <div className="absolute inset-0 backface-hidden rounded-2xl border bg-card flex flex-col items-center justify-center gap-2 p-6">
            <div className="flex items-center gap-2">
              <p className="text-center text-h1 font-extrabold">{card.word}</p>
              {card.audioUrl && <PronounceButton src={card.audioUrl} label={card.word} />}
            </div>
            {card.ipa !== "" && <p className="text-muted-foreground">/{card.ipa}/</p>}
            <p className="mt-4 text-caption text-muted-foreground">Nhấn để xem nghĩa ↻</p>
          </div>

          {/* Back: meaning + example */}
          <div className="absolute inset-0 backface-hidden rounded-2xl border bg-primary text-primary-foreground rotate-y-180 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-lg font-semibold">
              {card.meaningVi !== "" ? card.meaningVi : "(chưa có nghĩa)"}
            </p>
            {card.exampleEn !== "" && (
              <p className="text-sm italic opacity-90">{card.exampleEn}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="destructive" disabled={!flipped} onClick={() => handleReport(false)}>
          Chưa nhớ ✗
        </Button>
        <Button variant="success" disabled={!flipped} onClick={() => handleReport(true)}>
          Đã nhớ ✓
        </Button>
      </div>
    </div>
  );
}
