// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { playSfx } = vi.hoisted(() => ({ playSfx: vi.fn() }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { InlineExample } from "@/components/InlineExample";

const example = {
  id: "sp-1",
  prompt: "She ___ (go) to school every day.",
  hint: "Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
};

function mockFetch(response: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(response) });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  playSfx.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InlineExample", () => {
  it("renders the prompt and Vietnamese action labels, with the hint hidden", () => {
    mockFetch({});
    render(<InlineExample lessonId="l1" example={example} />);

    expect(screen.getByText(/She/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Gợi ý" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Xem đáp án" })).toBeDefined();
    expect(screen.queryByText(new RegExp(example.hint))).toBeNull();
  });

  it("shows the hint after clicking Gợi ý", () => {
    mockFetch({});
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.click(screen.getByRole("button", { name: "Gợi ý" }));

    expect(screen.getByText(new RegExp(example.hint))).toBeDefined();
  });

  it("checks via the API and shows the success state on a correct answer", async () => {
    const fetchFn = mockFetch({ correct: true, matchType: "EXACT", answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));

    await waitFor(() => expect(screen.getByText(/Chính xác!/)).toBeDefined());
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/lessons/l1/example-check",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ exampleId: "sp-1", input: "goes" }),
      }),
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("shows Thử lại on a wrong answer and lets the learner retype and re-check", async () => {
    mockFetch({ correct: false });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Thử lại" })).toBeDefined());
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });

    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeDefined();
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
  });

  it("reveals the answer via Xem đáp án and locks the card", async () => {
    mockFetch({ revealed: true, answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem đáp án" }));

    await waitFor(() => expect(screen.getByText(/goes/)).toBeDefined());
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Kiểm tra" })).toBeNull();
  });

  it("kêu tiếng đúng khi trả lời đúng", async () => {
    mockFetch({ correct: true, matchType: "EXACT", answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));

    await waitFor(() => expect(playSfx).toHaveBeenCalledWith("correct"));
    expect(playSfx).toHaveBeenCalledTimes(1);
  });

  it("kêu tiếng sai khi trả lời sai", async () => {
    mockFetch({ correct: false });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));

    await waitFor(() => expect(playSfx).toHaveBeenCalledWith("wrong"));
    expect(playSfx).toHaveBeenCalledTimes(1);
  });

  it("xem đáp án thì im lặng — khen người bỏ cuộc thì sai, mà phạt thì cũng sai", async () => {
    mockFetch({ revealed: true, answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem đáp án" }));

    await waitFor(() => expect(screen.getByText(/goes/)).toBeDefined());
    expect(playSfx).not.toHaveBeenCalled();
  });

  it("submits on Enter", async () => {
    const fetchFn = mockFetch({ correct: true, matchType: "EXACT", answer: "goes" });
    render(<InlineExample lessonId="l1" example={example} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
  });
});
