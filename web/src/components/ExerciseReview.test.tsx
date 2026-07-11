// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ExerciseRunner } from "@/components/ExerciseRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

const questions: SafeQuestion[] = [
  {
    id: "q1",
    number: 1,
    prompt: "Câu 1: I ______ a student.",
    options: null,
    kind: "FILL_BLANK",
    isOpenEnded: false,
  },
  {
    id: "q2",
    number: 2,
    prompt: "Câu 2: She ______ to school.",
    options: null,
    kind: "FILL_BLANK",
    isOpenEnded: false,
  },
];

function renderRunner() {
  return render(
    <ExerciseRunner
      exerciseId="ex1"
      attemptId="a1"
      initialQuestionNumber={1}
      questions={questions}
      nextLesson={null}
      backHref="/learn/x"
    />,
  );
}

/** Answers question 1 correctly and advances to question 2. */
async function answerFirstAndContinue() {
  const input = document.querySelector("[data-answer-field]") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "am" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await screen.findByText("Chính xác!");
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  await screen.findByText(/Câu 2:/);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExerciseRunner — xem lại câu trước (chỉ đọc)", () => {
  it("hiện câu đã trả lời ở chế độ chỉ đọc, không gọi API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ correct: true, correctAnswer: "am", keyNote: "to be" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderRunner();
    await answerFirstAndContinue();
    const callsAfterAnswer = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "← Câu trước" }));

    expect(screen.getByText(/Xem lại — Câu 1\/2/)).toBeTruthy();
    expect(screen.getByText(/Câu 1: I/)).toBeTruthy();
    expect(screen.getByText(/Câu trả lời của bạn:/).textContent).toContain("am");
    expect(screen.getByText(/^Đáp án:/).textContent).toContain("am");
    // Read-only: no answer input, and no extra network call.
    expect(document.querySelector("[data-answer-field]")).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(callsAfterAnswer);
  });

  it("ẩn nút nộp khi đang xem lại và khôi phục câu hiện tại khi thoát", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ correct: true, correctAnswer: "am" }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    renderRunner();
    await answerFirstAndContinue();

    fireEvent.click(screen.getByRole("button", { name: "← Câu trước" }));
    expect(screen.queryByRole("button", { name: "Kiểm tra" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quay lại câu hiện tại" }));
    expect(screen.getByText(/Câu 2:/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeTruthy();
  });

  it("vô hiệu hoá '← Câu trước' ở câu đầu tiên", () => {
    renderRunner();
    const back = screen.getByRole("button", { name: "← Câu trước" }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
  });
});
