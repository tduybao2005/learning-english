import { ExerciseRunner } from "web";

const mcq = {
  id: "q1",
  number: 1,
  prompt: "She ___ to school every morning.",
  options: [
    { label: "A", text: "go" },
    { label: "B", text: "goes" },
    { label: "C", text: "going" },
    { label: "D", text: "gone" },
  ],
  kind: "MULTIPLE_CHOICE" as const,
  isOpenEnded: false,
};

const fill = {
  id: "q2",
  number: 2,
  prompt: "I ___ (live) in Hanoi for five years.",
  options: null,
  kind: "FILL_BLANK" as const,
  isOpenEnded: false,
};

const questions = [mcq, fill, { ...fill, id: "q3", number: 3, prompt: "They ___ (not / arrive) yet." }];

const base = {
  exerciseId: "ex-1",
  attemptId: "attempt-1",
  nextLesson: { slug: "lesson-06", phaseSlug: "phase-2", title: "Bài 6 — Thì quá khứ đơn" },
  backHref: "/learn/phase-2/lesson-05",
  linkComponent: "a" as const,
};

/**
 * Answering — the default phase: progress bar, kicker, question card, "Kiểm tra".
 *
 * The graded phases (correct / incorrect / finished) and the read-only review
 * card CANNOT be rendered statically: `phase` lives in an internal reducer and
 * only advances after a POST to `/api/attempts/:id/answers`, and the review
 * card only opens on a click. Design the graded look from `QuestionCard`'s own
 * Correct / Incorrect stories (`status="correct" | "incorrect"`, shown on a
 * FILL_BLANK), plus `ExplanationSlot`. Card chrome: correct =
 * `border-success/50 bg-success-bg`, incorrect = `border-destructive/50 bg-destructive/5`.
 */
export const Answering = () => (
  <div className="w-[52rem]">
    <ExerciseRunner {...base} initialQuestionNumber={1} questions={questions} />
  </div>
);

/** Fill-in-the-blank question, mid-exercise (progress bar partly filled). */
export const FillBlank = () => (
  <div className="w-[52rem]">
    <ExerciseRunner {...base} initialQuestionNumber={2} questions={questions} />
  </div>
);

/** Resumed attempt: `initialPast` hydrates history, so "← Câu trước" is live. */
export const Resumed = () => (
  <div className="w-[52rem]">
    <ExerciseRunner
      {...base}
      initialQuestionNumber={3}
      questions={questions}
      initialPast={[
        { index: 0, answerText: "goes", correctAnswer: "goes", keyNote: "Ngôi thứ ba số ít thêm -s." },
        { index: 1, answerText: "have lived", correctAnswer: "have lived", keyNote: null },
      ]}
    />
  </div>
);

/** An exercise with no seeded questions. */
export const Empty = () => (
  <div className="w-[52rem]">
    <ExerciseRunner {...base} initialQuestionNumber={1} questions={[]} />
  </div>
);
