// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { expect, test, vi, beforeEach, afterEach } from "vitest";

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

function mockFetchByQuestion(results: Record<string, { correct: boolean; correctAnswer?: string; keyNote?: string }>) {
  return vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const result = results[body.questionId] ?? { correct: true };
    return {
      json: async () => result,
    } as Response;
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
});

test("renders all questions of the current section, submit disabled until all answered", () => {
  render(<SectionedListeningRunner slug="test-set" sections={sections} />);

  expect(screen.getAllByRole("textbox")).toHaveLength(2);

  const submitBtn = screen.getByRole("button", { name: "Nộp phần" });
  expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "6pm" } });
  expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(inputs[1], { target: { value: "8am" } });
  expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
});

test("on submit, calls fetch once per question, reveals correct/incorrect, and always enables Tiếp tục", async () => {
  const fetchMock = mockFetchByQuestion({
    q1: { correct: true },
    q2: { correct: false, correctAnswer: "8am", keyNote: "Nhớ giờ mở cửa" },
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<SectionedListeningRunner slug="test-set" sections={sections} />);

  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "6pm" } });
  fireEvent.change(inputs[1], { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Nộp phần" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

  const continueBtn = await screen.findByRole("button", { name: "Tiếp tục" });
  expect((continueBtn as HTMLButtonElement).disabled).toBe(false);

  expect(screen.getByText("8am")).toBeDefined();
});

test("Tiếp tục advances to next section, fires onSectionSubmitted once, onSectionChange with new index; completion panel after last section", async () => {
  const fetchMock = mockFetchByQuestion({
    q1: { correct: true },
    q2: { correct: true },
    q3: { correct: true },
  });
  vi.stubGlobal("fetch", fetchMock);

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

  let inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "6pm" } });
  fireEvent.change(inputs[1], { target: { value: "8am" } });
  fireEvent.click(screen.getByRole("button", { name: "Nộp phần" }));

  await screen.findByRole("button", { name: "Tiếp tục" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

  expect(onSectionSubmitted).toHaveBeenCalledTimes(1);
  expect(onSectionSubmitted).toHaveBeenCalledWith(0);
  expect(onSectionChange).toHaveBeenCalledWith(1);

  inputs = screen.getAllByRole("textbox");
  expect(inputs).toHaveLength(1);
  fireEvent.change(inputs[0], { target: { value: "9pm" } });
  fireEvent.click(screen.getByRole("button", { name: "Nộp phần" }));

  await screen.findByRole("button", { name: "Tiếp tục" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

  expect(onSectionSubmitted).toHaveBeenCalledTimes(2);
  expect(onSectionSubmitted).toHaveBeenCalledWith(1);

  expect(await screen.findByText(/Hoàn thành cả 2 phần/)).toBeDefined();
});

test("Làm lại resets to blank section 1 and calls onReset", async () => {
  const fetchMock = mockFetchByQuestion({
    q1: { correct: true },
    q2: { correct: true },
    q3: { correct: true },
  });
  vi.stubGlobal("fetch", fetchMock);

  const onReset = vi.fn();

  render(<SectionedListeningRunner slug="test-set" sections={sections} onReset={onReset} />);

  let inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "6pm" } });
  fireEvent.change(inputs[1], { target: { value: "8am" } });
  fireEvent.click(screen.getByRole("button", { name: "Nộp phần" }));
  await screen.findByRole("button", { name: "Tiếp tục" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

  inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "9pm" } });
  fireEvent.click(screen.getByRole("button", { name: "Nộp phần" }));
  await screen.findByRole("button", { name: "Tiếp tục" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

  await screen.findByText(/Hoàn thành cả 2 phần/);

  fireEvent.click(screen.getByRole("button", { name: "Làm lại" }));

  expect(onReset).toHaveBeenCalledTimes(1);
  inputs = screen.getAllByRole("textbox");
  expect(inputs).toHaveLength(2);
  inputs.forEach((input) => expect((input as HTMLInputElement | HTMLTextAreaElement).value).toBe(""));
  expect((screen.getByRole("button", { name: "Nộp phần" }) as HTMLButtonElement).disabled).toBe(true);
});
