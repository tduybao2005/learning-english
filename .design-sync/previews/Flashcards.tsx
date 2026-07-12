import { Flashcards } from "web";

const words = [
  {
    id: "w1",
    word: "resilient",
    ipa: "rɪˈzɪliənt",
    meaningVi: "kiên cường, bền bỉ",
    exampleEn: "She is remarkably resilient under pressure.",
    groupName: "Tính cách",
  },
  {
    id: "w2",
    word: "advocate",
    ipa: "ˈædvəkeɪt",
    meaningVi: "ủng hộ, biện hộ",
    exampleEn: "He advocates for cleaner public transport.",
    groupName: "Tính cách",
  },
  {
    id: "w3",
    word: "scarce",
    ipa: "skeəs",
    meaningVi: "khan hiếm",
    exampleEn: "Fresh water is scarce in the region.",
    groupName: "Môi trường",
  },
];

/**
 * Mid-session: progress bar, the FRONT of the card (word + IPA), and the two
 * self-report buttons — disabled until the card is flipped.
 *
 * The flipped (back) face and the per-card advance are internal `useState`;
 * they cannot be seeded from props. The back face is `bg-primary
 * text-primary-foreground` with the meaning + example centred.
 */
export const MidSession = () => (
  <div className="w-[36rem]">
    <Flashcards words={words} backHref="/vocab/lesson-05" linkComponent="a" />
  </div>
);

/**
 * The finish screen (🎉 + "Học lại" / "Quay lại từ vựng"). With an empty deck
 * the session is complete on first render, which is the only static route to
 * this state — hence the 0/0 counts.
 */
export const Finished = () => (
  <div className="w-[36rem]">
    <Flashcards words={[]} backHref="/vocab/lesson-05" linkComponent="a" />
  </div>
);
