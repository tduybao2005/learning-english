// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const { playWordAudio, stopWordAudio, playSfx } = vi.hoisted(() => ({
  playWordAudio: vi.fn(),
  stopWordAudio: vi.fn(),
  playSfx: vi.fn(),
}));
vi.mock("@/lib/audio/word-audio", () => ({ playWordAudio, stopWordAudio }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { MatchBoard } from "@/components/vocab/MatchBoard";
import type { MatchRound } from "@/components/vocab/games";

const pairs = [
  { wordId: "w1", word: "bread", meaningVi: "bánh mì", audioUrl: "/audio/vocab/bread.mp3" },
  { wordId: "w2", word: "milk", meaningVi: "sữa", audioUrl: null },
];
const round: MatchRound = { pairs, left: pairs, right: pairs };

function clickPair(word: string, meaning: string) {
  fireEvent.click(screen.getAllByTestId("match-left").find((e) => e.textContent === word)!);
  fireEvent.click(screen.getAllByTestId("match-right").find((e) => e.textContent === meaning)!);
}

beforeEach(() => {
  playWordAudio.mockClear();
  stopWordAudio.mockClear();
  playSfx.mockClear();
});

test("ghép đúng thì đọc từ tiếng Anh, không kêu ting", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("bread", "bánh mì");

  expect(playWordAudio).toHaveBeenCalledWith("/audio/vocab/bread.mp3");
  expect(playSfx).not.toHaveBeenCalledWith("correct");
});

test("từ chưa có mp3 thì im lặng, không quay lại tiếng ting", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("milk", "sữa");

  expect(playWordAudio).toHaveBeenCalledWith(null);
  expect(playSfx).not.toHaveBeenCalledWith("correct");
});

test("ghép sai vẫn kêu tiếng báo sai — đó là báo lỗi, không phải phần thưởng", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("bread", "sữa");

  expect(playSfx).toHaveBeenCalledWith("wrong");
  expect(playWordAudio).not.toHaveBeenCalled();
});

test("ghép sai thì cắt giọng đọc đang chạy trước khi kêu tiếng sai", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("bread", "sữa");

  expect(stopWordAudio).toHaveBeenCalled();
  expect(playSfx).toHaveBeenCalledWith("wrong");
});
