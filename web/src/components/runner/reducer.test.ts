import { describe, it, expect } from "vitest";
import { initRunnerState, runnerReducer, type RunnerState } from "./reducer";

const Q = ["q1", "q2", "q3"];

describe("initRunnerState", () => {
  it("starts in 'answering' at the given index with tries=1 and empty input", () => {
    const state = initRunnerState(Q, 0);
    expect(state.phase).toBe("answering");
    expect(state.index).toBe(0);
    expect(state.tries).toBe(1);
    expect(state.input).toBe("");
    expect(state.result).toBeNull();
  });

  it("resumes at a mid-attempt index (e.g. currentQuestionNumber - 1)", () => {
    const state = initRunnerState(Q, 1);
    expect(state.index).toBe(1);
    expect(state.phase).toBe("answering");
  });

  it("clamps an out-of-range start index into bounds", () => {
    expect(initRunnerState(Q, 99).index).toBe(2);
    expect(initRunnerState(Q, -5).index).toBe(0);
  });
});

describe("runnerReducer: answering -> checking -> correct | incorrect", () => {
  it("SUBMIT moves answering -> checking, preserving the input", () => {
    let state = initRunnerState(Q, 0);
    state = runnerReducer(state, { type: "SET_INPUT", value: "cooks" });
    state = runnerReducer(state, { type: "SUBMIT" });
    expect(state.phase).toBe("checking");
    expect(state.input).toBe("cooks");
  });

  it("SUBMIT is a no-op when the input is blank", () => {
    const state = initRunnerState(Q, 0);
    const next = runnerReducer(state, { type: "SUBMIT" });
    expect(next.phase).toBe("answering");
  });

  it("RESULT with correct:false -> phase 'incorrect'", () => {
    let state = initRunnerState(Q, 0);
    state = runnerReducer(state, { type: "SET_INPUT", value: "cook" });
    state = runnerReducer(state, { type: "SUBMIT" });
    state = runnerReducer(state, { type: "RESULT", result: { correct: false } });
    expect(state.phase).toBe("incorrect");
  });

  it("RESULT with correct:true -> phase 'correct' and stores the result payload", () => {
    let state = initRunnerState(Q, 0);
    state = runnerReducer(state, { type: "SET_INPUT", value: "cooks" });
    state = runnerReducer(state, { type: "SUBMIT" });
    state = runnerReducer(state, {
      type: "RESULT",
      result: { correct: true, matchType: "EXACT", correctAnswer: "cooks", keyNote: null, explanation: null },
    });
    expect(state.phase).toBe("correct");
    expect(state.result?.correctAnswer).toBe("cooks");
  });
});

describe("runnerReducer: incorrect phase", () => {
  function toIncorrect(): RunnerState {
    let state = initRunnerState(Q, 0);
    state = runnerReducer(state, { type: "SET_INPUT", value: "cook" });
    state = runnerReducer(state, { type: "SUBMIT" });
    state = runnerReducer(state, { type: "RESULT", result: { correct: false } });
    return state;
  }

  it("keeps the input editable (SET_INPUT works from 'incorrect')", () => {
    let state = toIncorrect();
    state = runnerReducer(state, { type: "SET_INPUT", value: "cooks" });
    expect(state.input).toBe("cooks");
    expect(state.phase).toBe("incorrect");
  });

  it("increments the local tries display on each wrong submission", () => {
    let state = toIncorrect();
    expect(state.tries).toBe(2);

    state = runnerReducer(state, { type: "SET_INPUT", value: "cooking" });
    state = runnerReducer(state, { type: "SUBMIT" });
    expect(state.phase).toBe("checking");
    state = runnerReducer(state, { type: "RESULT", result: { correct: false } });
    expect(state.tries).toBe(3);
  });

  it("can resubmit from 'incorrect' and eventually land on 'correct'", () => {
    let state = toIncorrect();
    state = runnerReducer(state, { type: "SET_INPUT", value: "cooks" });
    state = runnerReducer(state, { type: "SUBMIT" });
    state = runnerReducer(state, {
      type: "RESULT",
      result: { correct: true, matchType: "EXACT", correctAnswer: "cooks", keyNote: null, explanation: null },
    });
    expect(state.phase).toBe("correct");
    expect(state.tries).toBe(2); // unchanged by a correct result (was already 2 after the one wrong try)
  });
});

describe("runnerReducer: CONTINUE", () => {
  function toCorrect(index: number, completedLesson?: { nextLessonSlug: string | null } | null): RunnerState {
    let state = initRunnerState(Q, index);
    state = runnerReducer(state, { type: "SET_INPUT", value: "x" });
    state = runnerReducer(state, { type: "SUBMIT" });
    state = runnerReducer(state, {
      type: "RESULT",
      result: { correct: true, correctAnswer: "x", explanation: null, completedLesson },
    });
    return state;
  }

  it("is a no-op unless phase is 'correct'", () => {
    const state = initRunnerState(Q, 0);
    const next = runnerReducer(state, { type: "CONTINUE" });
    expect(next).toBe(state);
  });

  it("advances to the next question, resetting phase/input/tries/result", () => {
    let state = toCorrect(0);
    state = runnerReducer(state, { type: "CONTINUE" });
    expect(state.phase).toBe("answering");
    expect(state.index).toBe(1);
    expect(state.input).toBe("");
    expect(state.tries).toBe(1);
    expect(state.result).toBeNull();
  });

  it("on the last question, correct -> finished (not advancing index past bounds)", () => {
    let state = toCorrect(Q.length - 1, { nextLessonSlug: "lesson_02" });
    state = runnerReducer(state, { type: "CONTINUE" });
    expect(state.phase).toBe("finished");
    expect(state.completedLesson).toEqual({ nextLessonSlug: "lesson_02" });
  });
});
