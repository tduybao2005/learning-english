import { PlacementWizard } from "web";

const noop = () => {};
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA==";

// The wizard opens on the listening step, so one story suffices. The two fetch()
// calls fire only on submit — the static render is correct; interactive submit
// inside a design would fail (documented in NOTES.md).
export const ListeningStep = () => (
  <PlacementWizard
    listening={{
      audioUrl: SILENT_WAV,
      durationSec: 300,
      sections: [
        {
          label: "Section 1",
          title: "At the Library",
          instructions: "Nghe đoạn hội thoại và chọn đáp án đúng.",
          questions: [
            {
              id: "q1",
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
              id: "q2",
              number: 2,
              prompt: "The student needs a ______ to borrow books.",
              options: null,
              kind: "FILL_BLANK" as const,
              isOpenEnded: false,
            },
          ],
        },
      ],
    }}
    readingMd="## Passage 1"
    readingSections={[]}
    writingPromptMd="Viết 150 từ về chủ đề sau."
    onFinished={noop}
  />
);
