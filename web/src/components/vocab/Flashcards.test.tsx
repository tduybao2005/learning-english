// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Flashcards, type FlashcardWord } from "@/components/vocab/Flashcards";

function makeWords(n: number): FlashcardWord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    word: `word${i}`,
    ipa: `ipa${i}`,
    meaningVi: `nghĩa ${i}`,
    exampleEn: `example ${i}`,
    groupName: "Nhóm A",
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

function renderCards(n = 3) {
  return render(<Flashcards words={makeWords(n)} backHref="/vocab" linkComponent="a" />);
}

/** Kéo thẻ đi `dx` pixel rồi thả. */
function swipe(dx: number) {
  const card = screen.getByTestId("flashcard");
  fireEvent.pointerDown(card, { clientX: 0, pointerId: 1 });
  fireEvent.pointerMove(card, { clientX: dx, pointerId: 1 });
  fireEvent.pointerUp(card, { clientX: dx, pointerId: 1 });
  act(() => {
    vi.advanceTimersByTime(400);
  });
}

function flip() {
  fireEvent.click(screen.getByTestId("flashcard"));
}

test("chưa lật thẻ thì hiện gợi ý lật, không hiện 2 nút chết", () => {
  renderCards();
  expect(screen.getByText(/Lật thẻ/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Đã nhớ/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Chưa nhớ/ })).toBeNull();
});

test("lật thẻ rồi mới hiện 2 nút tự đánh giá", () => {
  renderCards();
  flip();
  expect(screen.getByRole("button", { name: /Đã nhớ/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Chưa nhớ/ })).toBeTruthy();
});

test("vuốt sang phải quá ngưỡng sau khi lật thì sang thẻ kế", () => {
  renderCards(3);
  expect(screen.getByText("Thẻ 1/3")).toBeTruthy();
  flip();
  swipe(150);
  expect(screen.getByText("Thẻ 2/3")).toBeTruthy();
});

test("vuốt chưa đủ ngưỡng thì ở lại thẻ hiện tại", () => {
  renderCards(3);
  flip();
  swipe(40);
  expect(screen.getByText("Thẻ 1/3")).toBeTruthy();
});

test("chưa lật thẻ thì vuốt không được tính, vẫn ở thẻ hiện tại", () => {
  renderCards(3);
  swipe(150);
  expect(screen.getByText("Thẻ 1/3")).toBeTruthy();
});

test("phím mũi tên phải tính là đã nhớ, mũi tên trái tính là chưa nhớ", () => {
  renderCards(3);
  flip();
  fireEvent.keyDown(window, { key: "ArrowRight" });
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByText("Thẻ 2/3")).toBeTruthy();

  flip();
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(screen.getByText("Thẻ 3/3")).toBeTruthy();
});

test("vuốt hết bộ thẻ thì hiện màn hình kết thúc với số đã nhớ đúng", () => {
  renderCards(2);
  flip();
  swipe(150); // đã nhớ
  flip();
  swipe(-150); // chưa nhớ
  expect(screen.getByText("Hoàn thành phiên học!")).toBeTruthy();
  expect(screen.getByTestId("summary-correct").textContent).toBe("1");
});
