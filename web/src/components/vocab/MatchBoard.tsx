"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/audio/sfx";
import { playWordAudio } from "@/lib/audio/word-audio";
import type { MatchRound } from "@/components/vocab/games";

/** Khớp thời lượng `tile-collapse` trong globals.css. */
const TILE_COLLAPSE_MS = 280;
const WRONG_FLASH_MS = 500;

/**
 * Một bàn ghép cặp: hai cột EN/VI xáo độc lập, bấm một ô trái rồi một ô phải
 * (thứ tự nào cũng được). Cặp đúng khoá lại rồi thu nhỏ biến mất; cặp sai
 * rung đỏ rồi bỏ chọn.
 *
 * Khác `MatchGame` cũ ở chỗ component này KHÔNG quản lý phiên: nó chơi đúng
 * một bàn rồi gọi `onComplete` kèm danh sách từ tiếng Anh đã bấm nhầm, để
 * `PracticeSession` đẩy chúng vào hàng đợi ôn lại. Chỉ tính ô cột trái —
 * bấm nhầm ô nghĩa không có nghĩa là người học chưa thuộc từ ở ô nghĩa đó.
 */
export function MatchBoard({
  round,
  onComplete,
}: {
  round: MatchRound;
  onComplete: (wrongWordIds: string[]) => void;
}) {
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [vanished, setVanished] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const wrongIdsRef = useRef<Set<string>>(new Set());
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Bàn mới thì dọn sạch trạng thái cũ — cùng một component được dùng lại
  // cho mọi chặng, React không tự remount khi chỉ đổi prop `round`.
  useEffect(() => {
    setMatched(new Set());
    setVanished(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
    wrongIdsRef.current = new Set();
  }, [round]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);

  function evaluate(leftId: string, rightId: string) {
    if (leftId === rightId) {
      // Ghép đúng thì thứ đáng nghe là chính từ vừa ghép, không phải tiếng
      // "ting" — người học ghép sáu cặp là nghe được sáu lần phát âm.
      // `pairs` là nguồn chân lý của bàn (cột trái/phải chỉ là bản xáo).
      playWordAudio(round.pairs.find((p) => p.wordId === leftId)?.audioUrl ?? null);
      const nextMatched = new Set(matched);
      nextMatched.add(leftId);
      setMatched(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);

      timeoutsRef.current.push(
        setTimeout(() => {
          setVanished((v) => new Set(v).add(leftId));
          if (nextMatched.size >= round.pairs.length) {
            onComplete([...wrongIdsRef.current]);
          }
        }, TILE_COLLAPSE_MS),
      );
      return;
    }

    playSfx("wrong");
    wrongIdsRef.current.add(leftId);
    setWrongPair({ left: leftId, right: rightId });
    timeoutsRef.current.push(
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, WRONG_FLASH_MS),
    );
  }

  function handleClickLeft(id: string) {
    if (matched.has(id) || wrongPair) return;
    if (selectedLeft === id) {
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft(id);
    if (selectedRight !== null) evaluate(id, selectedRight);
  }

  function handleClickRight(id: string) {
    if (matched.has(id) || wrongPair) return;
    if (selectedRight === id) {
      setSelectedRight(null);
      return;
    }
    setSelectedRight(id);
    if (selectedLeft !== null) evaluate(selectedLeft, id);
  }

  const tileClass = (state: { matched: boolean; wrong: boolean; selected: boolean }) =>
    cn(
      "min-h-11 rounded-xl border p-3 text-left font-medium transition-all",
      state.matched && "animate-tile-collapse border-success bg-success-bg text-success",
      !state.matched &&
        state.wrong &&
        "animate-shake border-destructive bg-destructive-bg text-destructive",
      !state.matched &&
        !state.wrong &&
        state.selected &&
        "-translate-y-0.5 border-primary bg-primary/10 shadow-md ring-2 ring-primary/25",
      !state.matched &&
        !state.wrong &&
        !state.selected &&
        "border-border bg-card hover:border-primary/40 hover:shadow-sm",
    );

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="match-board">
      <div className="flex flex-col gap-2">
        {round.left.map((pair) => {
          if (vanished.has(pair.wordId)) return null;
          return (
            <button
              key={pair.wordId}
              type="button"
              disabled={matched.has(pair.wordId)}
              data-testid="match-left"
              onClick={() => handleClickLeft(pair.wordId)}
              className={tileClass({
                matched: matched.has(pair.wordId),
                wrong: wrongPair?.left === pair.wordId,
                selected: selectedLeft === pair.wordId,
              })}
            >
              {pair.word}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        {round.right.map((pair) => {
          if (vanished.has(pair.wordId)) return null;
          return (
            <button
              key={pair.wordId}
              type="button"
              disabled={matched.has(pair.wordId)}
              data-testid="match-right"
              onClick={() => handleClickRight(pair.wordId)}
              className={tileClass({
                matched: matched.has(pair.wordId),
                wrong: wrongPair?.right === pair.wordId,
                selected: selectedRight === pair.wordId,
              })}
            >
              {pair.meaningVi}
            </button>
          );
        })}
      </div>
    </div>
  );
}
