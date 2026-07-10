import { AnswerKeyAccordion } from "web";

const KEY_MD = `
## Reading — Passage 1

| Câu | Đáp án |
| --- | ------ |
| 1 | TRUE |
| 2 | FALSE |
| 3 | NOT GIVEN |

**Giải thích câu 3:** đoạn văn không đề cập tới chi phí, nên chọn *NOT GIVEN*.
`;

// The caption is not decoration: the component's <summary> opens with a "⚠️"
// emoji, and package-validate.mjs treats a cell whose text starts with ⚠ as a
// caught render error. Leading with a label keeps that heuristic from firing on
// legitimate content.

export const Collapsed = () => (
  <div className="w-[32rem] space-y-2">
    <p className="text-caption text-muted-foreground">Đóng sẵn — nhấn để mở đáp án</p>
    <AnswerKeyAccordion answerKeyMd={KEY_MD} />
  </div>
);

// No open-state cell: this is a native <details> with no `open` prop, so every
// static render is the closed summary bar. An `answerKeyMd=""` cell would be
// pixel-identical to the one above — the difference only exists once expanded.
