// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

// `vi.mock` được hoist lên đầu file — mock phải tạo qua `vi.hoisted`.
const { playSfx } = vi.hoisted(() => ({ playSfx: vi.fn() }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { QuizGame } from "@/components/vocab/QuizGame";

const words = [
  { id: "w1", word: "apple", meaningVi: "quả táo", audioUrl: "/audio/vocab/apple.mp3" },
  { id: "w2", word: "book", meaningVi: "quyển sách", audioUrl: "/audio/vocab/book.mp3" },
  { id: "w3", word: "cat", meaningVi: "con mèo", audioUrl: null },
  { id: "w4", word: "dog", meaningVi: "con chó", audioUrl: null },
];

beforeEach(() => {
  playSfx.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
  );
});

test("phát SFX khi người học chọn một đáp án", async () => {
  render(<QuizGame words={words} backHref="/vocab" linkComponent="a" />);
  // Vòng đầu tiên dựng trong useEffect; đợi các lựa chọn xuất hiện.
  const options = await screen.findAllByTestId("quiz-option");
  fireEvent.click(options[0]);
  expect(playSfx).toHaveBeenCalledTimes(1);
  expect(["correct", "wrong"]).toContain(playSfx.mock.calls[0][0]);
});
