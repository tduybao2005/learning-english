import { normalize } from "./normalize";
import { similarity } from "./match";

export type ErrorSpan = { start: number; end: number };

/** Strips the trailing "Lỗi: ___ → Sửa: ___" scaffold some seeded
 * ERROR_CORRECTION prompts carry — the retype-the-sentence UI replaces it. */
export function stripErrorScaffold(prompt: string): string {
  return prompt.replace(/(?:→|->)?\s*Lỗi:\s*_{2,}\s*(?:→|->)\s*Sửa:\s*_{2,}\s*$/m, "").trim();
}

type Token = { text: string; start: number; end: number };

function tokenize(prompt: string): Token[] {
  const tokens: Token[] = [];
  for (const m of prompt.matchAll(/[A-Za-z0-9'’-]+/g)) {
    tokens.push({ text: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  return tokens;
}

/**
 * Locates the words in the original (wrong) sentence that the corrected
 * variant most plausibly replaces, so the UI can wavy-underline them as a
 * hint. Sliding word-window vs the normalized variant; a window is a
 * candidate only when similar-but-not-equal (0.5 ≤ score < 1). Null when
 * nothing clears the bar — callers render no underline (safe fallback).
 */
export function findErrorSpan(prompt: string, variantNormalized: string): ErrorSpan | null {
  const variantWords = variantNormalized.split(" ").filter(Boolean);
  if (variantWords.length === 0) return null;
  const tokens = tokenize(prompt);
  let best: { span: ErrorSpan; score: number } | null = null;
  for (const size of [variantWords.length, variantWords.length - 1, variantWords.length + 1]) {
    if (size < 1) continue;
    for (let i = 0; i + size <= tokens.length; i++) {
      const window = tokens.slice(i, i + size);
      const text = normalize(window.map((t) => t.text).join(" "));
      const score = similarity(text, variantNormalized);
      if (score >= 0.5 && score < 1 && (!best || score > best.score)) {
        best = { span: { start: window[0].start, end: window[window.length - 1].end }, score };
      }
    }
  }
  return best?.span ?? null;
}
