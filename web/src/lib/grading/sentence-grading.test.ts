import { describe, expect, it } from "vitest";
import { gradeSentence } from "./sentence-grading";

describe("gradeSentence", () => {
  const canon = ["He likes spicy food."];

  it("accepts the exact correct sentence", () => {
    expect(gradeSentence("He likes spicy food.", canon)).toEqual({ correct: true, reason: null });
  });

  it("rejects a misspelled/incomplete word (no fuzzy leniency)", () => {
    // The bug the user hit: 'foo' ≈ 'food' used to pass via FUZZY.
    expect(gradeSentence("He likes spicy foo", canon).correct).toBe(false);
  });

  it("rejects an entirely wrong sentence with no minor-issue reason", () => {
    expect(gradeSentence("He hates spicy food.", canon)).toEqual({ correct: false, reason: null });
  });

  it("rejects but explains a missing capital letter", () => {
    const g = gradeSentence("he likes spicy food.", canon);
    expect(g.correct).toBe(false);
    expect(g.reason).toMatch(/viết hoa/i);
  });

  it("rejects but explains a missing final period", () => {
    const g = gradeSentence("He likes spicy food", canon);
    expect(g.correct).toBe(false);
    expect(g.reason).toMatch(/dấu chấm/i);
  });

  it("explains both minor issues together", () => {
    const g = gradeSentence("he likes spicy food", canon);
    expect(g.correct).toBe(false);
    expect(g.reason).toMatch(/viết hoa/i);
    expect(g.reason).toMatch(/dấu chấm/i);
  });

  it("accepts a contraction-equivalent form", () => {
    expect(gradeSentence("She does not like vegetables.", ["She doesn't like vegetables."]).correct).toBe(true);
  });

  it("prefers a fully-correct canonical over one with a minor issue", () => {
    // input is fully correct for the second canonical
    const g = gradeSentence("They are here.", ["they are here", "They are here."]);
    expect(g).toEqual({ correct: true, reason: null });
  });

  it("returns a generic wrong for empty input", () => {
    expect(gradeSentence("", canon)).toEqual({ correct: false, reason: null });
  });
});
