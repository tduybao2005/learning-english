// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

// `vi.mock` được hoist lên đầu file — mock phải tạo qua `vi.hoisted`.
const { celebrate } = vi.hoisted(() => ({ celebrate: vi.fn() }));
vi.mock("@/lib/celebrate", () => ({ celebrate }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx: vi.fn() }));

import { ExerciseRunner } from "@/components/ExerciseRunner";

const questions = [
  { id: "q1", kind: "FILL_BLANK" as const, prompt: "She ___ (go).", orderIndex: 0, options: [] },
];

beforeEach(() => {
  celebrate.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ correct: true, correctAnswer: "goes" }),
      }),
    ),
  );
});

async function finishExercise() {
  render(
    <ExerciseRunner
      exerciseId="e1"
      attemptId="a1"
      initialQuestionNumber={1}
      questions={questions}
      nextLesson={{ slug: "lesson_02", phaseSlug: "phase_1", title: "Bài 2: Thì quá khứ" }}
      backHref="/learn/phase_1/lesson_01"
      lessonTitle="Bài 1"
      linkComponent="a"
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await screen.findByRole("button", { name: "Tiếp tục" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
}

test("gọi celebrate() đúng một lần khi vào màn hình hoàn thành", async () => {
  await finishExercise();
  await screen.findByText("Hoàn thành bài tập!");
  await waitFor(() => expect(celebrate).toHaveBeenCalledTimes(1));
});

test("hiện link sang bài học vừa mở khoá", async () => {
  await finishExercise();
  const link = await screen.findByRole("link", { name: /Học bài tiếp theo/ });
  expect(link.getAttribute("href")).toBe("/learn/phase_1/lesson_02");
});
