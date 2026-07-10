import { QuestionCard } from "web";

const noop = () => {};

const MCQ = {
  id: "q1",
  number: 1,
  prompt: "She ___ in Hanoi since 2019.",
  options: [
    { label: "A", text: "live" },
    { label: "B", text: "has lived" },
    { label: "C", text: "is living" },
    { label: "D", text: "lived" },
  ],
  kind: "MULTIPLE_CHOICE" as const,
  isOpenEnded: false,
};

const FILL = {
  id: "q2",
  number: 2,
  prompt: "I have known him ___ ten years.",
  options: null,
  kind: "FILL_BLANK" as const,
  isOpenEnded: false,
};

export const MultipleChoice = () => (
  <div className="w-[34rem]">
    <QuestionCard question={MCQ} disabled={false} onChangeInput={noop} />
  </div>
);

export const FillBlank = () => (
  <div className="w-[34rem]">
    <QuestionCard question={FILL} disabled={false} onChangeInput={noop} emphasizePrompt />
  </div>
);

// Graded states are shown on FILL_BLANK, not MULTIPLE_CHOICE: the option a
// learner picked lives in QuestionCard's internal useState with no prop to seed
// it, so a static render of a graded MCQ can only ever look plain-disabled.
export const Correct = () => (
  <div className="w-[34rem]">
    <QuestionCard question={FILL} disabled status="correct" onChangeInput={noop} />
  </div>
);

export const Incorrect = () => (
  <div className="w-[34rem]">
    <QuestionCard question={FILL} disabled status="incorrect" onChangeInput={noop} />
  </div>
);
