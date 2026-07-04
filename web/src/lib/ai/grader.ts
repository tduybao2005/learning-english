/**
 * Explanation generation for wrong answers.
 *
 * `NullExplainer` is the only implementation for now — this task wires the
 * call site (the answers route always awaits `explainer.explain(...)` on a
 * wrong answer and stores whatever comes back) without actually calling an
 * LLM. FUTURE: an env-gated `HttpExplainer` swaps in behind the same
 * `Explainer` interface with no call-site changes.
 */

export interface ExplainInput {
  questionPrompt: string;
  questionKind: string;
  userAnswer: string;
  correctAnswers: string[];
  keyNote: string | null;
  lessonSlug: string;
}

export interface Explainer {
  explain(input: ExplainInput): Promise<string | null>;
}

export class NullExplainer implements Explainer {
  async explain(): Promise<string | null> {
    return null;
  }
}

// FUTURE: env-gated HttpExplainer (e.g. `process.env.EXPLAINER_URL ? new HttpExplainer(...) : new NullExplainer()`).
export const explainer: Explainer = new NullExplainer();
