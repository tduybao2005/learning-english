import { ListeningSetView } from "web";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA==";

const TRANSCRIPT = `
Librarian: Good morning. How can I help you?
Student: Hi, I'd like to apply for a library card.
Librarian: Of course. Do you have a student ID with you?
Student: Yes, here it is.
`;

const SECTIONS = [
  {
    label: "Section 1",
    title: "At the Library",
    instructions: "Nghe đoạn hội thoại và chọn đáp án đúng.",
    questions: [
      {
        id: "s1q1",
        number: 1,
        prompt: "What does the student want?",
        options: [
          { label: "A", text: "A library card" },
          { label: "B", text: "A textbook" },
        ],
        kind: "MULTIPLE_CHOICE" as const,
        isOpenEnded: false,
      },
    ],
  },
];

export const Default = () => (
  <div className="w-[38rem]">
    <ListeningSetView
      slug="practice_a2_02"
      audioUrl={SILENT_WAV}
      transcriptMd={TRANSCRIPT}
      sections={SECTIONS}
    />
  </div>
);
