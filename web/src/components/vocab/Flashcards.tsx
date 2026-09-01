"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PronounceButton } from "@/components/vocab/PronounceButton";
import { SessionSummary } from "@/components/vocab/SessionSummary";
import { resolveSwipe } from "@/components/vocab/games";

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

/** Quãng kéo ngang tối thiểu để tính là một lần tự đánh giá. */
const SWIPE_THRESHOLD = 100;
/** Khớp với thời lượng `fly-off-*` trong globals.css. */
const EXIT_MS = 220;
/** Kéo quá ngần này thì cú thả không được hiểu là "bấm để lật". */
const DRAG_SLOP = 6;

/**
 * A single-lesson flashcard session: word+IPA front, meaning+example back,
 * flip on tap, then self-report "Đã nhớ ✓ / Chưa nhớ ✗" — bằng nút, bằng vuốt
 * trái/phải, hoặc bằng phím ←/→. Results accumulate client-side and are
 * batch-POSTed to `/api/vocab/review` once, at the end of the session — not
 * per-card — so a partially-abandoned session never writes partial Leitner
 * state.
 *
 * Chỉ tự đánh giá được sau khi đã lật thẻ: vuốt hay bấm phím lúc chưa lật đều
 * bị bỏ qua, vì đoán mà chưa thấy nghĩa thì không phải một lần ôn thật.
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
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "know" | "dont-know">(null);
  const startXRef = useRef(0);
  const movedRef = useRef(false);

  const total = words.length;
  const done = index >= total;
  const card = words[index];
  const canReport = flipped && exiting === null && !done;

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

  function advance(correct: boolean) {
    const next = [...results, { wordId: words[index].id, correct }];
    setResults(next);
    setFlipped(false);
    setIndex(index + 1);
    // Sang thẻ mới là một lượt tương tác mới — nếu không xoá cờ ở đây thì cú
    // chạm đầu tiên trên thẻ kế tiếp bị hiểu nhầm là đuôi của cú kéo trước.
    movedRef.current = false;
    if (index + 1 >= total) {
      void submitResults(next);
    }
  }

  /** Cho thẻ bay đi rồi mới đổi sang thẻ kế, để chuyển cảnh liền mạch. */
  function report(correct: boolean) {
    if (!canReport) return;
    setExiting(correct ? "know" : "dont-know");
    setDragX(0);
    setDragging(false);
    window.setTimeout(() => {
      setExiting(null);
      advance(correct);
    }, EXIT_MS);
  }

  // Phím ←/→ để tự đánh giá trên desktop, tương đương vuốt trên di động.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!canReport) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        report(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        report(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function handleRestart() {
    setIndex(0);
    setFlipped(false);
    setResults([]);
    setSaveState("idle");
    setDragX(0);
    setExiting(null);
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
  const remaining = total - index - 1;
  // Ý định của cú vuốt đang diễn ra, dùng để tô viền thẻ theo hướng kéo.
  const intent = dragging ? resolveSwipe(dragX, SWIPE_THRESHOLD) : "none";

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
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="relative">
        {/* Hai thẻ mờ phía sau tạo cảm giác còn cả một cỗ bài phía trước. */}
        {remaining > 0 && (
          <div
            aria-hidden
            className="absolute inset-x-3 top-2 h-64 rounded-2xl border border-border bg-card opacity-60 lg:h-80"
          />
        )}
        {remaining > 1 && (
          <div
            aria-hidden
            className="absolute inset-x-6 top-4 h-64 rounded-2xl border border-border bg-card opacity-35 lg:h-80"
          />
        )}

        {/* `role="button"` chứ không phải <button>: nút loa nằm bên trong thẻ, mà
            lồng <button> trong <button> là HTML không hợp lệ. */}
        <div
          key={index}
          role="button"
          tabIndex={0}
          onClick={() => {
            // Trình duyệt bắn một cú click ngay sau khi kéo xong — nuốt đúng
            // cú đó rồi trả cờ về, nếu không thì cú chạm đầu tiên trên thẻ kế
            // tiếp cũng bị bỏ qua.
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            setFlipped((f) => !f);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          onPointerDown={(e) => {
            if (!canReport) return;
            startXRef.current = e.clientX;
            movedRef.current = false;
            setDragging(true);
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const dx = e.clientX - startXRef.current;
            if (Math.abs(dx) > DRAG_SLOP) movedRef.current = true;
            setDragX(dx);
          }}
          onPointerUp={(e) => {
            if (!dragging) return;
            const dx = e.clientX - startXRef.current;
            setDragging(false);
            const outcome = resolveSwipe(dx, SWIPE_THRESHOLD);
            if (outcome === "know") report(true);
            else if (outcome === "dont-know") report(false);
            else setDragX(0);
          }}
          onPointerCancel={() => {
            setDragging(false);
            setDragX(0);
          }}
          className={cn(
            "relative w-full touch-pan-y text-left perspective-flip",
            exiting === null && "animate-item-in",
            exiting === "know" && "animate-fly-off-right",
            exiting === "dont-know" && "animate-fly-off-left",
          )}
          style={
            dragging ? { transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)` } : undefined
          }
          aria-label={flipped ? "Lật lại mặt trước" : "Nhấn để lật thẻ và xem nghĩa"}
          data-testid="flashcard"
          data-flipped={flipped}
        >
          <div
            className={cn("relative h-64 w-full flip-inner lg:h-80", flipped && "flip-inner-flipped")}
          >
            {/* Front: word + IPA */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-6 backface-hidden transition-colors",
                intent === "know" && "border-success",
                intent === "dont-know" && "border-destructive",
              )}
            >
              <div className="flex items-center gap-2">
                <p className="text-center text-h1 font-extrabold">{card.word}</p>
                {card.audioUrl && <PronounceButton src={card.audioUrl} label={card.word} />}
              </div>
              {card.ipa !== "" && <p className="text-muted-foreground">/{card.ipa}/</p>}
              <p className="mt-4 text-caption text-muted-foreground">Nhấn để xem nghĩa ↻</p>
            </div>

            {/* Back: meaning + example */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-primary p-6 text-center text-primary-foreground backface-hidden rotate-y-180 transition-colors",
                intent === "know" && "border-success",
                intent === "dont-know" && "border-destructive",
              )}
            >
              <p className="text-lg font-semibold">
                {card.meaningVi !== "" ? card.meaningVi : "(chưa có nghĩa)"}
              </p>
              {card.exampleEn !== "" && <p className="text-sm italic opacity-90">{card.exampleEn}</p>}
            </div>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex justify-center gap-3">
            <Button variant="destructive" onClick={() => report(false)}>
              Chưa nhớ ✗
            </Button>
            <Button variant="success" onClick={() => report(true)}>
              Đã nhớ ✓
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">Hoặc vuốt thẻ: ← chưa nhớ · đã nhớ →</p>
        </div>
      ) : (
        <p className="text-center text-caption text-muted-foreground">
          Lật thẻ để tự đánh giá xem đã nhớ từ này chưa.
        </p>
      )}
    </div>
  );
}
