/**
 * Renders an AI explanation for a wrong answer, or nothing at all.
 *
 * `explanation` is always `null` today (`NullExplainer`) — this component is
 * the future slot where an LLM-generated explanation will appear once
 * `lib/ai/grader.ts` grows a real `Explainer` implementation. Kept as its own
 * component (rather than an inline `{explanation && ...}`) so that future
 * work (loading state, markdown rendering, etc.) has one place to land.
 */
export function ExplanationSlot({ explanation }: { explanation: string | null }) {
  if (!explanation) return null;

  return (
    <div className="mt-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-muted-foreground">
      {explanation}
    </div>
  );
}
