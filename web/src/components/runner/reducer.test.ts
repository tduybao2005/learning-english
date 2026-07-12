import { describe, it, expect } from "vitest";

import { runnerReducer, initRunnerState } from "./reducer";

/** Drives a fresh state to the `incorrect` phase on the first question. */
function toIncorrect() {
  let s = initRunnerState(["q1", "q2"], 0);
  s = runnerReducer(s, { type: "SET_INPUT", value: "wrong" });
  s = runnerReducer(s, { type: "SUBMIT" });
  s = runnerReducer(s, { type: "RESULT", result: { correct: false } });
  return s;
}

describe("REDO_QUESTION", () => {
  it("resets an incorrect question back to answering without moving index", () => {
    const s = toIncorrect();
    expect(s.phase).toBe("incorrect");

    const redone = runnerReducer(s, { type: "REDO_QUESTION" });
    expect(redone.phase).toBe("answering");
    expect(redone.input).toBe("");
    expect(redone.result).toBeNull();
    expect(redone.index).toBe(0);
  });

  it("is a no-op while answering or checking", () => {
    const s = initRunnerState(["q1"], 0);
    expect(runnerReducer(s, { type: "REDO_QUESTION" })).toBe(s);
  });
});

describe("CONTINUE from an incorrect answer", () => {
  it("advances to the next question even when the current one is wrong", () => {
    const s = toIncorrect();
    const next = runnerReducer(s, { type: "CONTINUE" });
    expect(next.index).toBe(1);
    expect(next.phase).toBe("answering");
    expect(next.input).toBe("");
    expect(next.result).toBeNull();
  });

  it("finishes when the last question is skipped while incorrect", () => {
    let s = initRunnerState(["q1"], 0);
    s = runnerReducer(s, { type: "SET_INPUT", value: "wrong" });
    s = runnerReducer(s, { type: "SUBMIT" });
    s = runnerReducer(s, { type: "RESULT", result: { correct: false } });
    const done = runnerReducer(s, { type: "CONTINUE" });
    expect(done.phase).toBe("finished");
  });
});
