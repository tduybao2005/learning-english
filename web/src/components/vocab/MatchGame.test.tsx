// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MatchGame } from "@/components/vocab/MatchGame";
import type { VocabWordLite } from "@/components/vocab/games";

function makeWords(n: number): VocabWordLite[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    word: `word${i}`,
    meaningVi: `nghĩa ${i}`,
    audioUrl: null,
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true } as Response)),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("ghép đúng thì cặp ô biến mất khỏi bảng để bàn ngắn dần", () => {
  render(<MatchGame words={makeWords(6)} backHref="/vocab" lessonId="l1" linkComponent="a" />);

  expect(screen.getByText("word0")).toBeTruthy();
  expect(screen.getByText("nghĩa 0")).toBeTruthy();

  fireEvent.click(screen.getByText("word0"));
  fireEvent.click(screen.getByText("nghĩa 0"));
  act(() => {
    vi.advanceTimersByTime(600);
  });

  expect(screen.queryByText("word0")).toBeNull();
  expect(screen.queryByText("nghĩa 0")).toBeNull();
  // Các cặp chưa ghép vẫn còn nguyên trên bàn.
  expect(screen.getByText("word1")).toBeTruthy();
});

test("ghép sai thì không ô nào biến mất", () => {
  render(<MatchGame words={makeWords(6)} backHref="/vocab" lessonId="l1" linkComponent="a" />);

  fireEvent.click(screen.getByText("word0"));
  fireEvent.click(screen.getByText("nghĩa 1"));
  act(() => {
    vi.advanceTimersByTime(600);
  });

  expect(screen.getByText("word0")).toBeTruthy();
  expect(screen.getByText("nghĩa 1")).toBeTruthy();
});
