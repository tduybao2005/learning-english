import { MatchGame } from "web";

const words = [
  { id: "w1", word: "resilient", meaningVi: "kiên cường, bền bỉ" },
  { id: "w2", word: "advocate", meaningVi: "ủng hộ, biện hộ" },
  { id: "w3", word: "scarce", meaningVi: "khan hiếm" },
  { id: "w4", word: "vivid", meaningVi: "sống động" },
  { id: "w5", word: "reluctant", meaningVi: "miễn cưỡng" },
  { id: "w6", word: "thorough", meaningVi: "kỹ lưỡng" },
];

/**
 * Mid-game: the timer row and the two independently-shuffled tile columns
 * (English left, Vietnamese right), nothing matched yet.
 *
 * Rounds are shuffled in a `useEffect` (hydration-safety), so tile order
 * differs per render. Selected / matched / wrong-flash tiles and the 🔗 finish
 * screen live in internal `useState` and cannot be seeded from props.
 */
export const MidGame = () => (
  <div className="w-[36rem]">
    <MatchGame words={words} backHref="/vocab/lesson-05" lessonId="lesson-05" linkComponent="a" />
  </div>
);

/** Not enough usable words to build a round. */
export const TooFewWords = () => (
  <div className="w-[36rem]">
    <MatchGame words={[]} backHref="/vocab/lesson-05" lessonId="lesson-05" linkComponent="a" />
  </div>
);
