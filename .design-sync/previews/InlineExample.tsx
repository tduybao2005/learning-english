import { InlineExample } from "web";

const example = {
  id: "ex-1",
  prompt: "She ___ (live) in Hanoi since 2019.",
  hint: "Dùng thì hiện tại hoàn thành với 'since'.",
};

// Untried: empty input, "Kiểm tra" / "Gợi ý" / "Xem đáp án" available.
//
// The correct / wrong / revealed states are NOT statically renderable: the
// status lives in an internal useState and only changes after a POST to
// `/api/lessons/:id/example-check` (the answer is deliberately never shipped
// to the client). Style those states from the tokens documented in the prompt
// file: correct = `border-success/50 bg-success-bg/40` + a `text-success`
// line; wrong = an `aria-invalid` Input + a `text-destructive` line.
export const Untried = () => (
  <div className="w-[36rem]">
    <InlineExample lessonId="lesson-05" example={example} />
  </div>
);

export const LongPrompt = () => (
  <div className="w-[36rem]">
    <InlineExample
      lessonId="lesson-05"
      example={{
        id: "ex-2",
        prompt:
          "Although he had studied for weeks, he ___ (not / pass) the exam, which surprised everyone in the class.",
        hint: "Quá khứ đơn, thể phủ định.",
      }}
    />
  </div>
);
