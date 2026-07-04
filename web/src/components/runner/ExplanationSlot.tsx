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
    <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
      {explanation}
    </div>
  );
}
