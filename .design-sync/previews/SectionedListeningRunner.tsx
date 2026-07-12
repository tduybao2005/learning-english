import { SectionedListeningRunner } from "web";

// The runner owns its own state (section index, answers, grading phase), so a
// preview only has to hand it sections — it opens on section 1, "answering".
const SECTIONS = [
  {
    label: "Section 1",
    title: "At the Library",
    instructions: "Nghe đoạn hội thoại và chọn đáp án đúng.",
    questions: [
      {
        id: "s1q1",
        number: 1,
        prompt: "What time does the library close on weekdays?",
        options: [
          { label: "A", text: "6 p.m." },
          { label: "B", text: "8 p.m." },
          { label: "C", text: "9 p.m." },
        ],
        kind: "MULTIPLE_CHOICE" as const,
        isOpenEnded: false,
      },
      {
        id: "s1q2",
        number: 2,
        prompt: "The membership card costs ___ dollars.",
        options: null,
        kind: "FILL_BLANK" as const,
        isOpenEnded: false,
      },
    ],
  },
  {
    label: "Section 2",
    title: "Sports and Leisure",
    instructions: null,
    questions: [
      {
        id: "s2q1",
        number: 3,
        prompt: "Which sport is mentioned first?",
        options: [
          { label: "A", text: "Tennis" },
          { label: "B", text: "Swimming" },
        ],
        kind: "MULTIPLE_CHOICE" as const,
        isOpenEnded: false,
      },
    ],
  },
];

export const FirstSection = () => (
  <div className="w-[36rem]">
    <SectionedListeningRunner slug="practice_a2_02" sections={SECTIONS} />
  </div>
);

// Nothing to answer yet — the fallback card.
export const NoQuestions = () => (
  <div className="w-[36rem]">
    <SectionedListeningRunner slug="practice_a2_02" sections={[]} />
  </div>
);
