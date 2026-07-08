/**
 * Client-side state machine for the exercise runner.
 *
 * Phases: `answering -> checking -> correct | incorrect`.
 * - `incorrect` keeps the input editable (the learner can retype and resubmit)
 *   and bumps a local `tries` display counter (server-side truth for tries
 *   lives in `AttemptAnswer.tries`; this is purely for the UI).
 * - `correct` surfaces a "Tiếp tục" affordance; `CONTINUE` advances to the
 *   next question, or to `finished` if this was the last question.
 *
 * Deliberately dumb: this module knows nothing about HTTP. The component
 * dispatches `SUBMIT` immediately (optimistic "checking" phase), calls the
 * API, then dispatches `RESULT` with what came back.
 */

export type RunnerPhase = "answering" | "checking" | "correct" | "incorrect" | "finished";

export interface AnswerResult {
  correct: boolean;
  matchType?: string;
  keyNote?: string | null;
  correctAnswer?: string | null;
  /** A precise "almost-right" hint (missing capital/period) for strictly
   * graded sentence kinds — shown instead of the generic wrong message. */
  reason?: string | null;
  explanation?: string | null;
  completedLesson?: { nextLessonSlug: string | null } | null;
}

export interface RunnerState {
  /** Ordered question ids for this attempt (index-addressable). */
  questionIds: string[];
  /** Index into `questionIds` of the question currently being answered. */
  index: number;
  phase: RunnerPhase;
  /** Current editable answer text. */
  input: string;
  /** Local display count of attempts made on the current question (starts at 1). */
  tries: number;
  /** Most recent answer result, kept around while phase is correct/incorrect. */
  result: AnswerResult | null;
  /** Set once the final question is answered correctly. */
  completedLesson: { nextLessonSlug: string | null } | null;
}

export type RunnerAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "SUBMIT" }
  | { type: "RESULT"; result: AnswerResult }
  | { type: "CONTINUE" };

export function initRunnerState(questionIds: string[], startIndex: number): RunnerState {
  const index = Math.min(Math.max(startIndex, 0), Math.max(questionIds.length - 1, 0));
  return {
    questionIds,
    index,
    phase: questionIds.length === 0 ? "finished" : "answering",
    input: "",
    tries: 1,
    result: null,
    completedLesson: null,
  };
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case "SET_INPUT": {
      // Editable in both answering and incorrect phases; a no-op otherwise.
      if (state.phase !== "answering" && state.phase !== "incorrect") return state;
      return { ...state, input: action.value };
    }

    case "SUBMIT": {
      if (state.phase !== "answering" && state.phase !== "incorrect") return state;
      if (state.input.trim() === "") return state;
      return { ...state, phase: "checking" };
    }

    case "RESULT": {
      if (state.phase !== "checking") return state;
      if (action.result.correct) {
        return { ...state, phase: "correct", result: action.result };
      }
      return { ...state, phase: "incorrect", tries: state.tries + 1, result: action.result };
    }

    case "CONTINUE": {
      if (state.phase !== "correct") return state;
      const isLast = state.index >= state.questionIds.length - 1;
      if (isLast) {
        return {
          ...state,
          phase: "finished",
          completedLesson: state.result?.completedLesson ?? null,
        };
      }
      return {
        ...state,
        index: state.index + 1,
        phase: "answering",
        input: "",
        tries: 1,
        result: null,
      };
    }

    default:
      return state;
  }
}
