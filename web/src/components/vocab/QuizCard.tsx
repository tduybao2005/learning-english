"use client";

import { cn } from "@/lib/utils";
import { PronounceButton } from "@/components/vocab/PronounceButton";
import type { QuizRound, VocabWordLite } from "@/components/vocab/games";

/**
 * Một câu trắc nghiệm: câu dẫn + các lựa chọn, phản hồi đúng/sai ngay khi
 * bấm. Chỉ hiển thị — trạng thái chọn và nhịp chuyển câu do `PracticeSession`
 * giữ, vì lựa chọn đó còn nuôi hàng đợi ôn lại của engine.
 */
export function QuizCard({
  round,
  word,
  selectedId,
  onSelect,
}: {
  round: QuizRound;
  /** Từ tiếng Anh của câu này — dùng cho nút "Nghe lại" sau khi lộ đáp án. */
  word: VocabWordLite | undefined;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
}) {
  const answered = selectedId !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="animate-item-in rounded-2xl border border-border bg-card p-6 text-center">
        <p className="mb-1 text-xs text-muted-foreground">
          {round.direction === "EN_TO_VI"
            ? "Nghĩa tiếng Việt của từ này là gì?"
            : "Từ tiếng Anh nào có nghĩa này?"}
        </p>
        <p data-testid="quiz-prompt" className="text-2xl font-bold">
          {round.prompt}
        </p>
      </div>

      <div className="animate-item-in grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="quiz-options">
        {round.options.map((option, i) => {
          const label = String.fromCharCode(65 + i);
          const isCorrect = option.id === round.correctOptionId;
          const isSelected = option.id === selectedId;
          const isCorrectPick = isSelected && answered && isCorrect;
          const isWrong = isSelected && answered && !isCorrect;
          // Chọn sai thì lộ luôn đáp án đúng — phiên này không cho làm lại
          // câu đó ngay, nó sẽ quay lại qua hàng đợi ôn lại.
          const isCorrectReveal = answered && isCorrect && !isSelected;

          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              data-testid="quiz-option"
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors disabled:opacity-70",
                isSelected && !isWrong && !isCorrectPick && "border-primary bg-primary/10",
                !isSelected && !isCorrectReveal && "border-border hover:bg-muted",
                isWrong && "animate-shake border-destructive bg-destructive-bg",
                (isCorrectPick || isCorrectReveal) && "border-success bg-success-bg",
                isCorrectPick && "animate-pop",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  isWrong && "bg-destructive/15 text-destructive",
                  (isCorrectPick || isCorrectReveal) && "bg-success text-success-foreground",
                  isSelected && !isWrong && !isCorrectPick && "bg-primary text-primary-foreground",
                  !isSelected && !isCorrectReveal && "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </span>
              <span>{option.text}</span>
              {isWrong && <span className="ml-auto text-destructive">✕</span>}
              {(isCorrectPick || isCorrectReveal) && <span className="ml-auto text-success">✓</span>}
            </button>
          );
        })}
      </div>

      {answered && word?.audioUrl && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Nghe lại:</span>
          <span className="font-semibold text-foreground">{word.word}</span>
          <PronounceButton src={word.audioUrl} label={word.word} />
        </div>
      )}
    </div>
  );
}
