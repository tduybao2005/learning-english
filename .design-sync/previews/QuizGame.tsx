import { QuizGame } from "web";

const words = [
  { id: "w1", word: "resilient", meaningVi: "kiên cường, bền bỉ" },
  { id: "w2", word: "advocate", meaningVi: "ủng hộ, biện hộ" },
  { id: "w3", word: "scarce", meaningVi: "khan hiếm" },
  { id: "w4", word: "vivid", meaningVi: "sống động" },
  { id: "w5", word: "reluctant", meaningVi: "miễn cưỡng" },
  { id: "w6", word: "thorough", meaningVi: "kỹ lưỡng" },
];

/**
 * Mid-quiz: progress bar, streak pill, prompt card and the 4 answer tiles in
 * their untouched state.
 *
 * Rounds are shuffled in a `useEffect` (hydration-safety), so the prompt and
 * option order differ per render — that is expected, not a bug. The graded
 * tiles (right pick = `border-success bg-success-bg` + ✓, wrong pick =
 * `animate-shake border-destructive bg-destructive-bg` + ✕, plus the reveal of
 * the correct option) and the 🏆 finish screen are internal `useState` and
 * cannot be seeded from props.
 */
export const MidQuiz = () => (
  <div className="w-[36rem]">
    <QuizGame words={words} backHref="/vocab/lesson-05" linkComponent="a" />
  </div>
);

/** Not enough usable words (an empty `meaningVi` makes an unplayable round). */
export const TooFewWords = () => (
  <div className="w-[36rem]">
    <QuizGame words={[]} backHref="/vocab/lesson-05" linkComponent="a" />
  </div>
);
