import { describe, expect, it } from "vitest";

import {
  initSectionRunnerState,
  isSectionComplete,
  sectionReducer,
  sectionScore,
  type SafeListeningSection,
  type SectionRunnerState,
} from "@/components/runner/section-runner";
import type { AnswerResult } from "@/components/runner/reducer";

function makeSection(questionIds: string[]): SafeListeningSection {
  return {
    label: "Phần 1",
    title: "Section 1",
    instructions: null,
    questions: questionIds.map((id, i) => ({
      id,
      number: i + 1,
      prompt: `Question ${i + 1}`,
      options: null,
      kind: "FILL_BLANK",
      isOpenEnded: false,
    })),
  };
}

function correctResult(): AnswerResult {
  return { correct: true };
}

function incorrectResult(): AnswerResult {
  return { correct: false, correctAnswer: "x" };
}

describe("initSectionRunnerState", () => {
  it("khởi tạo trạng thái ban đầu ở phase answering, mọi thứ trống", () => {
    const state = initSectionRunnerState();
    expect(state).toEqual<SectionRunnerState>({
      sectionIndex: 0,
      phase: "answering",
      answers: {},
      results: null,
      submittedSections: 0,
    });
  });
});

describe("isSectionComplete", () => {
  it("false khi có câu hỏi chưa trả lời", () => {
    const section = makeSection(["q1", "q2"]);
    expect(isSectionComplete(section, { q1: "abc" })).toBe(false);
  });

  it("false khi câu trả lời chỉ toàn khoảng trắng", () => {
    const section = makeSection(["q1", "q2"]);
    expect(isSectionComplete(section, { q1: "abc", q2: "   " })).toBe(false);
  });

  it("true khi mọi câu hỏi đều có câu trả lời không rỗng", () => {
    const section = makeSection(["q1", "q2"]);
    expect(isSectionComplete(section, { q1: "abc", q2: "def" })).toBe(true);
  });
});

describe("sectionScore", () => {
  it("đếm đúng số câu đúng trên tổng số câu", () => {
    const section = makeSection(["q1", "q2", "q3"]);
    const results: Record<string, AnswerResult> = {
      q1: correctResult(),
      q2: incorrectResult(),
      q3: correctResult(),
    };
    expect(sectionScore(section, results)).toEqual({ correct: 2, total: 3 });
  });
});

describe("sectionReducer", () => {
  it("SET_ANSWER lưu giá trị khi đang ở phase answering", () => {
    const state = initSectionRunnerState();
    const next = sectionReducer(state, { type: "SET_ANSWER", questionId: "q1", value: "abc" });
    expect(next.answers).toEqual({ q1: "abc" });
  });

  it("SET_ANSWER không có tác dụng khi không ở phase answering", () => {
    const state: SectionRunnerState = { ...initSectionRunnerState(), phase: "checking" };
    const next = sectionReducer(state, { type: "SET_ANSWER", questionId: "q1", value: "abc" });
    expect(next).toBe(state);
  });

  it("SUBMIT_SECTION chuyển answering -> checking", () => {
    const state = initSectionRunnerState();
    const next = sectionReducer(state, { type: "SUBMIT_SECTION" });
    expect(next.phase).toBe("checking");
  });

  it("SUBMIT_SECTION không có tác dụng khi không ở phase answering", () => {
    const state: SectionRunnerState = { ...initSectionRunnerState(), phase: "submitted" };
    const next = sectionReducer(state, { type: "SUBMIT_SECTION" });
    expect(next).toBe(state);
  });

  it("SECTION_RESULT lưu kết quả và chuyển checking -> submitted", () => {
    const state: SectionRunnerState = { ...initSectionRunnerState(), phase: "checking" };
    const results: Record<string, AnswerResult> = { q1: correctResult() };
    const next = sectionReducer(state, { type: "SECTION_RESULT", results });
    expect(next.phase).toBe("submitted");
    expect(next.results).toEqual(results);
  });

  it("SECTION_RESULT không có tác dụng khi không ở phase checking", () => {
    const state = initSectionRunnerState();
    const results: Record<string, AnswerResult> = { q1: correctResult() };
    const next = sectionReducer(state, { type: "SECTION_RESULT", results });
    expect(next).toBe(state);
  });

  it("CONTINUE từ submitted khi còn section: tăng sectionIndex, sectionSubmitted, xoá answers/results, quay lại answering", () => {
    const state: SectionRunnerState = {
      sectionIndex: 0,
      phase: "submitted",
      answers: { q1: "abc" },
      results: { q1: correctResult() },
      submittedSections: 0,
    };
    const next = sectionReducer(state, { type: "CONTINUE", totalSections: 3 });
    expect(next).toEqual<SectionRunnerState>({
      sectionIndex: 1,
      phase: "answering",
      answers: {},
      results: null,
      submittedSections: 1,
    });
  });

  it("CONTINUE từ submitted khi là section cuối: chuyển sang finished, vẫn tăng submittedSections", () => {
    const state: SectionRunnerState = {
      sectionIndex: 2,
      phase: "submitted",
      answers: { q1: "abc" },
      results: { q1: correctResult() },
      submittedSections: 2,
    };
    const next = sectionReducer(state, { type: "CONTINUE", totalSections: 3 });
    expect(next).toEqual<SectionRunnerState>({
      sectionIndex: 2,
      phase: "finished",
      answers: {},
      results: null,
      submittedSections: 3,
    });
  });

  it("CONTINUE không có tác dụng khi không ở phase submitted", () => {
    const state = initSectionRunnerState();
    const next = sectionReducer(state, { type: "CONTINUE", totalSections: 3 });
    expect(next).toBe(state);
  });

  it("submittedSections tăng đúng một lần cho mỗi section trong cả quá trình làm bài", () => {
    let state = initSectionRunnerState();
    const totalSections = 3;
    for (let i = 0; i < totalSections; i++) {
      state = sectionReducer(state, { type: "SUBMIT_SECTION" });
      state = sectionReducer(state, { type: "SECTION_RESULT", results: {} });
      const before = state.submittedSections;
      state = sectionReducer(state, { type: "CONTINUE", totalSections });
      expect(state.submittedSections).toBe(before + 1);
    }
    expect(state.submittedSections).toBe(totalSections);
    expect(state.phase).toBe("finished");
  });
});
