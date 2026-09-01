// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { QuizGame } from "@/components/vocab/QuizGame";
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

/** Chọn đáp án đầu tiên rồi chờ hết nhịp tự chuyển câu. */
function answerFirstOption() {
  fireEvent.click(screen.getAllByTestId("quiz-option")[0]);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

test("trả lời xong tự chuyển sang câu kế, không bắt bấm thêm nút nào", () => {
  render(<QuizGame words={makeWords(3)} backHref="/vocab" linkComponent="a" />);
  expect(screen.getByText("Câu 1/3")).toBeTruthy();

  fireEvent.click(screen.getAllByTestId("quiz-option")[0]);
  // Ngay sau khi chọn vẫn còn ở câu cũ để kịp nhìn đáp án đúng.
  expect(screen.getByText("Câu 1/3")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Câu tiếp theo/ })).toBeNull();

  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByText("Câu 2/3")).toBeTruthy();
});

test("câu cuối không tự chuyển mà chờ người học bấm xem kết quả", () => {
  render(<QuizGame words={makeWords(3)} backHref="/vocab" linkComponent="a" />);
  answerFirstOption();
  answerFirstOption();
  expect(screen.getByText("Câu 3/3")).toBeTruthy();

  fireEvent.click(screen.getAllByTestId("quiz-option")[0]);
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  // Vẫn ở câu cuối, và có nút để tự bấm sang màn hình kết quả.
  const resultButton = screen.getByRole("button", { name: /Xem kết quả/ });
  fireEvent.click(resultButton);
  expect(screen.getByText("Hoàn thành trắc nghiệm!")).toBeTruthy();
});

test("đạt chuỗi đúng 5 câu thì hiện huy hiệu mốc", () => {
  render(<QuizGame words={makeWords(12)} backHref="/vocab" linkComponent="a" />);

  // Suy ra đáp án đúng từ chính đề bài thay vì đọc thuộc tính trên DOM —
  // đáp án không được phép lộ ra DOM trước khi người học chọn. Đề là
  // "wordN" (hỏi nghĩa) hoặc "nghĩa N" (hỏi từ), nên chỉ cần khớp số N.
  for (let i = 0; i < 5; i += 1) {
    const prompt = screen.getByTestId("quiz-prompt").textContent ?? "";
    const n = prompt.match(/\d+/)?.[0];
    const options = screen.getAllByTestId("quiz-option");
    const correct = options.find((o) => (o.textContent ?? "").match(/\d+/)?.[0] === n);
    fireEvent.click(correct ?? options[0]);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }

  expect(screen.getByTestId("streak-milestone")).toBeTruthy();
});
