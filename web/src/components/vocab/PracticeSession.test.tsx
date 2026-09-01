// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PracticeSession } from "@/components/vocab/PracticeSession";
import type { VocabWordLite } from "@/components/vocab/games";

function makeWords(n: number): VocabWordLite[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    word: `word${i}`,
    meaningVi: `nghĩa ${i}`,
    audioUrl: null,
  }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Giải hết bàn ghép cặp đang hiện bằng cách bấm đúng từng cặp. */
function solveMatchBoard() {
  const lefts = screen.getAllByTestId("match-left");
  for (const left of lefts) {
    const label = left.textContent ?? "";
    const index = label.replace("word", "");
    fireEvent.click(left);
    const right = screen
      .getAllByTestId("match-right")
      .find((el) => el.textContent === `nghĩa ${index}`);
    fireEvent.click(right!);
    act(() => {
      vi.advanceTimersByTime(400);
    });
  }
}

function currentPromptWordIndex(): string {
  const prompt = screen.getByTestId("quiz-prompt").textContent ?? "";
  return prompt.replace("word", "").replace("nghĩa ", "").trim();
}

/** Trả lời câu trắc nghiệm đang hiện; `correct=false` thì cố tình chọn sai. */
function answerQuiz(correct: boolean) {
  const index = currentPromptWordIndex();
  const options = screen.getAllByTestId("quiz-option");
  const target = options.find((o) => {
    const text = o.textContent ?? "";
    const isRight = text.includes(`nghĩa ${index}`) || text.includes(`word${index}`);
    return correct ? isRight : !isRight;
  });
  fireEvent.click(target ?? options[0]);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

function isDone(): boolean {
  return screen.queryByText("Hoàn thành phiên luyện tập!") !== null;
}

/** Chơi đúng một bước, bất kể đang là bàn ghép cặp hay câu trắc nghiệm. */
function playStep(correct = true) {
  if (screen.queryByTestId("match-board") !== null) {
    solveMatchBoard();
    return;
  }
  answerQuiz(correct);
}

/**
 * Chơi đúng cho tới khi engine phát ra một câu ôn lại. Số câu xen vào trước
 * đó phụ thuộc khoảng chờ của hàng đợi, nên test không đếm cứng.
 */
function advanceToReviewBanner(limit = 25) {
  for (let i = 0; i < limit; i++) {
    if (screen.queryByTestId("review-banner") !== null) return;
    if (isDone()) throw new Error("phiên kết thúc trước khi có câu ôn lại");
    playStep(true);
  }
  throw new Error("không gặp câu ôn lại nào");
}

function finishAllCorrect(limit = 60) {
  for (let i = 0; i < limit && !isDone(); i++) playStep(true);
}

test("phiên mở đầu bằng bàn ghép cặp của chặng 1 rồi mới tới trắc nghiệm", () => {
  render(<PracticeSession words={makeWords(12)} backHref="/vocab" linkComponent="a" />);

  expect(screen.getByTestId("stage-counter").textContent).toBe("Chặng 1/2");
  expect(screen.getByTestId("match-board")).toBeTruthy();
  expect(screen.getAllByTestId("match-left")).toHaveLength(6);

  solveMatchBoard();
  expect(screen.queryByTestId("match-board")).toBeNull();
  expect(screen.getByTestId("quiz-prompt")).toBeTruthy();
});

test("trả lời sai thì phiên dài thêm và từ đó quay lại dưới nhãn ôn lại", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  solveMatchBoard();

  const missedIndex = currentPromptWordIndex();
  answerQuiz(false);
  expect(screen.getByTestId("review-chip").textContent).toContain("1 từ");

  // Câu ôn lại không hỏi ngay mà xen vào sau vài câu.
  expect(screen.queryByTestId("review-banner")).toBeNull();

  advanceToReviewBanner();
  expect(currentPromptWordIndex()).toBe(missedIndex);
  expect(isDone()).toBe(false);
});

test("phải trả lời đúng hai lần thì từ sai mới rời hàng đợi và phiên mới kết thúc", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  solveMatchBoard();

  answerQuiz(false);

  // Lần ôn thứ nhất đúng — vẫn còn nợ trong hàng đợi.
  advanceToReviewBanner();
  answerQuiz(true);
  expect(screen.getByTestId("review-chip").textContent).toContain("1 từ");

  // Lần ôn thứ hai đúng — hàng đợi sạch.
  advanceToReviewBanner();
  answerQuiz(true);
  expect(screen.queryByTestId("review-chip")).toBeNull();

  finishAllCorrect();
  expect(screen.getByText("Hoàn thành phiên luyện tập!")).toBeTruthy();
});

test("bấm nhầm cặp ở bàn ghép cặp cũng đẩy từ đó vào hàng đợi ôn lại", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);

  const left = screen.getAllByTestId("match-left")[0];
  const leftIndex = (left.textContent ?? "").replace("word", "");
  const wrongRight = screen
    .getAllByTestId("match-right")
    .find((el) => el.textContent !== `nghĩa ${leftIndex}`);
  fireEvent.click(left);
  fireEvent.click(wrongRight!);
  act(() => {
    vi.advanceTimersByTime(600);
  });

  solveMatchBoard();
  expect(screen.getByTestId("review-chip").textContent).toContain("1 từ");
});

test("chơi đúng hết thì kết thúc, gửi một kết quả cho mỗi từ và không có câu ôn lại", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  solveMatchBoard();
  for (let i = 0; i < 6; i++) answerQuiz(true);

  expect(screen.getByText("Hoàn thành phiên luyện tập!")).toBeTruthy();
  expect(screen.getByTestId("summary-correct").textContent).toBe("6");
  expect(screen.getByTestId("summary-total").textContent).toBe("/ 6");

  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  expect(body.results).toHaveLength(6);
  expect(new Set(body.results.map((r: { wordId: string }) => r.wordId)).size).toBe(6);
  expect(body.results.every((r: { correct: boolean }) => r.correct)).toBe(true);
});

test("từ đã sai một lần trong phiên được gửi lên là chưa thuộc, dù sau đó ôn đúng", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  solveMatchBoard();

  const missedIndex = currentPromptWordIndex();
  answerQuiz(false);
  finishAllCorrect();

  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  const missed = body.results.find((r: { wordId: string }) => r.wordId === `w${missedIndex}`);
  expect(missed.correct).toBe(false);
  expect(body.results.filter((r: { correct: boolean }) => r.correct)).toHaveLength(5);
});

test("thanh tiến độ đếm theo số từ đã xong, không theo số câu", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  expect(screen.getByTestId("session-progress").textContent).toContain("0/6 từ");

  // Ghép cặp chỉ là bước khởi động của chặng — chưa từ nào tính là xong.
  solveMatchBoard();
  expect(screen.getByTestId("session-progress").textContent).toContain("0/6 từ");

  answerQuiz(true);
  expect(screen.getByTestId("session-progress").textContent).toContain("1/6 từ");
});

test("chủ đề quá ít từ thì báo rõ thay vì dựng phiên hỏng", () => {
  render(<PracticeSession words={makeWords(3)} backHref="/vocab" linkComponent="a" />);
  expect(screen.getByText("Chủ đề này chưa đủ từ vựng để luyện tập.")).toBeTruthy();
});
