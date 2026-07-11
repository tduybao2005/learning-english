/**
 * Pure reducer + helpers for the section-batched listening practice runner.
 *
 * Distinct from `web/src/components/runner/reducer.ts` (the flat
 * forward-only question-by-question flow still used by `ExerciseRunner`).
 * Here, a whole section's worth of questions is answered, submitted, and
 * graded together: `answering -> checking -> submitted -> (answering | finished)`.
 *
 * Deliberately dumb, like its sibling: no HTTP here. The component gates
 * `SUBMIT_SECTION` on `isSectionComplete`, POSTs the section's answers, then
 * dispatches `SECTION_RESULT` with what came back.
 */

import type { AnswerResult } from "@/components/runner/reducer";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

/** Moved here (from `ListeningRunner.tsx`) so the new section-batched
 * component and its tests can import it from a neutral module. */
export interface SafeListeningSection {
  label: string;
  title: string;
  instructions: string | null;
  questions: SafeQuestion[];
}

export type SectionRunnerPhase = "answering" | "checking" | "submitted" | "finished";

export interface SectionRunnerState {
  sectionIndex: number;
  phase: SectionRunnerPhase;
  /** questionId -> current input, for the section being answered. */
  answers: Record<string, string>;
  /** Set once the current section's answers have been graded. */
  results: Record<string, AnswerResult> | null;
  /** Increments once per section, on CONTINUE — drives transcript unlock. */
  submittedSections: number;
}

export type SectionRunnerAction =
  | { type: "SET_ANSWER"; questionId: string; value: string }
  | { type: "SUBMIT_SECTION" }
  | { type: "SECTION_RESULT"; results: Record<string, AnswerResult> }
  | { type: "CONTINUE"; totalSections: number };

export function initSectionRunnerState(): SectionRunnerState {
  return {
    sectionIndex: 0,
    phase: "answering",
    answers: {},
    results: null,
    submittedSections: 0,
  };
}

/** True iff every question in `section` has a non-empty (trimmed) answer. */
export function isSectionComplete(
  section: SafeListeningSection,
  answers: Record<string, string>,
): boolean {
  return section.questions.every((q) => (answers[q.id] ?? "").trim() !== "");
}

export function sectionScore(
  section: SafeListeningSection,
  results: Record<string, AnswerResult>,
): { correct: number; total: number } {
  const total = section.questions.length;
  const correct = section.questions.reduce(
    (acc, q) => acc + (results[q.id]?.correct ? 1 : 0),
    0,
  );
  return { correct, total };
}

export function sectionReducer(
  state: SectionRunnerState,
  action: SectionRunnerAction,
): SectionRunnerState {
  switch (action.type) {
    case "SET_ANSWER": {
      if (state.phase !== "answering") return state;
      return { ...state, answers: { ...state.answers, [action.questionId]: action.value } };
    }

    case "SUBMIT_SECTION": {
      if (state.phase !== "answering") return state;
      return { ...state, phase: "checking" };
    }

    case "SECTION_RESULT": {
      if (state.phase !== "checking") return state;
      return { ...state, phase: "submitted", results: action.results };
    }

    case "CONTINUE": {
      if (state.phase !== "submitted") return state;
      const isLast = state.sectionIndex >= action.totalSections - 1;
      return {
        ...state,
        sectionIndex: isLast ? state.sectionIndex : state.sectionIndex + 1,
        phase: isLast ? "finished" : "answering",
        answers: {},
        results: null,
        submittedSections: state.submittedSections + 1,
      };
    }

    default:
      return state;
  }
}
