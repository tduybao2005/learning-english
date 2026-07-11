// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

import { SectionedListeningRunner } from "@/components/SectionedListeningRunner";
import type { SafeListeningSection } from "@/components/runner/section-runner";

const sections: SafeListeningSection[] = [
  {
    label: "Section 1",
    title: "At the Library",
    instructions: "Nghe và điền vào chỗ trống.",
    questions: [
      { id: "q1", number: 1, prompt: "The library closes at ______.", options: null, kind: "FILL_BLANK", isOpenEnded: false },
      { id: "q2", number: 2, prompt: "The library opens at ______.", options: null, kind: "FILL_BLANK", isOpenEnded: false },
    ],
  },
  {
    label: "Section 2",
    title: "At the Cafe",
    instructions: "Nghe và điền vào chỗ trống.",
    questions: [
      { id: "q3", number: 1, prompt: "The cafe closes at ______.", options: null, kind: "FILL_BLANK", isOpenEnded: false },
    ],
  },
];

/** The check route is per-question, so the runner fans out one POST per question. */
function mockFetchByQuestion(
  results: Record<string, { correct: boolean; correctAnswer?: string; keyNote?: string }>,
) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    return { json: async () => results[body.questionId] ?? { correct: true } } as Response;
  });
}

const btn = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

async function answerAndSubmit(values: string[]) {
  const inputs = screen.getAllByRole("textbox");
  values.forEach((v, i) => fireEvent.change(inputs[i], { target: { value: v } }));
  fireEvent.click(btn("Nộp phần"));
  await screen.findByRole("button", { name: "Tiếp tục" });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

test("hiển thị tất cả câu hỏi của phần hiện tại; chưa trả lời đủ thì chưa nộp được", () => {
  render(<SectionedListeningRunner slug="test-set" sections={sections} />);

  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  expect(btn("Nộp phần").disabled).toBe(true);

  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "6pm" } });
  expect(btn("Nộp phần").disabled).toBe(true);

  fireEvent.change(inputs[1], { target: { value: "8am" } });
  expect(btn("Nộp phần").disabled).toBe(false);
});

test("nộp phần: gọi check cho từng câu, lộ đáp án đúng của câu sai, vẫn cho đi tiếp", async () => {
  const fetchMock = mockFetchByQuestion({
    q1: { correct: true },
    q2: { correct: false, correctAnswer: "8am", keyNote: "Nhớ giờ mở cửa" },
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<SectionedListeningRunner slug="test-set" sections={sections} />);
  await answerAndSubmit(["6pm", "sai"]);

  // One POST per question in the section, not one for the whole section.
  expect(fetchMock).toHaveBeenCalledTimes(2);

  expect(screen.getByText(/8am/)).toBeDefined();
  expect(screen.getByText(/Nhớ giờ mở cửa/)).toBeDefined();
  // Không ép sửa đúng hết: vẫn đi tiếp được dù còn câu sai.
  expect(btn("Tiếp tục").disabled).toBe(false);
});

test("nộp xong phần là mở lời thoại ngay, không đợi bấm Tiếp tục", async () => {
  vi.stubGlobal("fetch", mockFetchByQuestion({ q1: { correct: true }, q2: { correct: false } }));
  const onSectionSubmitted = vi.fn();

  render(
    <SectionedListeningRunner slug="test-set" sections={sections} onSectionSubmitted={onSectionSubmitted} />,
  );

  await answerAndSubmit(["6pm", "sai"]);

  // Fires on submit, so the learner can read the transcript while reviewing
  // their answers — not deferred until "Tiếp tục".
  expect(onSectionSubmitted).toHaveBeenCalledTimes(1);
  expect(onSectionSubmitted).toHaveBeenCalledWith(0);
});

test("Tiếp tục sang phần sau, mỗi phần chỉ báo đã nộp một lần, hết phần thì hoàn thành", async () => {
  vi.stubGlobal("fetch", mockFetchByQuestion({ q1: { correct: true }, q2: { correct: true }, q3: { correct: true } }));

  const onSectionSubmitted = vi.fn();
  const onSectionChange = vi.fn();

  render(
    <SectionedListeningRunner
      slug="test-set"
      sections={sections}
      onSectionSubmitted={onSectionSubmitted}
      onSectionChange={onSectionChange}
    />,
  );

  expect(onSectionChange).toHaveBeenCalledWith(0);

  await answerAndSubmit(["6pm", "8am"]);
  fireEvent.click(btn("Tiếp tục"));

  // Audio follows the runner: the parent is told to swap to section 2's clip.
  expect(onSectionChange).toHaveBeenCalledWith(1);
  expect(screen.getAllByRole("textbox")).toHaveLength(1);

  await answerAndSubmit(["9pm"]);
  fireEvent.click(btn("Tiếp tục"));

  expect(onSectionSubmitted).toHaveBeenCalledTimes(2);
  expect(onSectionSubmitted.mock.calls.map((c) => c[0])).toEqual([0, 1]);
  expect(await screen.findByText(/Hoàn thành cả 2 phần/)).toBeDefined();
});

test("Làm lại: về phần 1 trống trơn và báo cho cha khoá lại lời thoại", async () => {
  vi.stubGlobal("fetch", mockFetchByQuestion({ q1: { correct: true }, q2: { correct: true }, q3: { correct: true } }));
  const onReset = vi.fn();

  render(<SectionedListeningRunner slug="test-set" sections={sections} onReset={onReset} />);

  await answerAndSubmit(["6pm", "8am"]);
  fireEvent.click(btn("Tiếp tục"));
  await answerAndSubmit(["9pm"]);
  fireEvent.click(btn("Tiếp tục"));
  await screen.findByText(/Hoàn thành cả 2 phần/);

  fireEvent.click(btn("Làm lại"));

  expect(onReset).toHaveBeenCalledTimes(1);
  const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
  expect(inputs).toHaveLength(2);
  inputs.forEach((input) => expect(input.value).toBe(""));
  expect(btn("Nộp phần").disabled).toBe(true);
});
