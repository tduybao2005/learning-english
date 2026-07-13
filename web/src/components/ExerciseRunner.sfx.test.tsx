// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

// `vi.mock` được hoist lên đầu file, nên factory không thể đọc biến khai báo
// bằng `const` ở dưới — phải tạo mock qua `vi.hoisted`.
const { playSfx } = vi.hoisted(() => ({ playSfx: vi.fn() }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));
vi.mock("@/lib/celebrate", () => ({ celebrate: vi.fn() }));

import { ExerciseRunner } from "@/components/ExerciseRunner";

const questions = [
  {
    id: "q1",
    kind: "FILL_BLANK" as const,
    prompt: "She ___ (go) to school.",
    orderIndex: 0,
    options: [],
  },
];

function renderRunner() {
  return render(
    <ExerciseRunner
      exerciseId="e1"
      attemptId="a1"
      initialQuestionNumber={1}
      questions={questions}
      nextLesson={{ slug: "lesson_02", phaseSlug: "phase_1", title: "Bài 2" }}
      backHref="/learn/phase_1/lesson_01"
      lessonTitle="Bài 1"
      linkComponent="a"
    />,
  );
}

function mockAnswer(correct: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ correct, correctAnswer: "goes" }),
      }),
    ),
  );
}

beforeEach(() => {
  playSfx.mockClear();
});

test("phát âm thanh đúng khi trả lời đúng", async () => {
  mockAnswer(true);
  renderRunner();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await waitFor(() => expect(playSfx).toHaveBeenCalledWith("correct"));
});

test("phát âm thanh sai khi trả lời sai", async () => {
  mockAnswer(false);
  renderRunner();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await waitFor(() => expect(playSfx).toHaveBeenCalledWith("wrong"));
});
