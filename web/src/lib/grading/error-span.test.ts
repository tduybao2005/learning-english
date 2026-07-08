import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";
import { findErrorSpan, stripErrorScaffold } from "./error-span";

describe("stripErrorScaffold", () => {
  it("removes the Lỗi/Sửa scaffold line", () => {
    const p = "She don't like vegetables.\n→ Lỗi: ___ → Sửa: ___";
    expect(stripErrorScaffold(p)).toBe("She don't like vegetables.");
  });
  it("leaves plain prompts unchanged", () => {
    expect(stripErrorScaffold("She don't like vegetables.")).toBe("She don't like vegetables.");
  });
});

describe("findErrorSpan", () => {
  it("finds the suspect words closest to the corrected variant", () => {
    const prompt = "She don't like vegetables.";
    const span = findErrorSpan(prompt, normalize("doesn't like"));
    expect(span).not.toBeNull();
    expect(prompt.slice(span!.start, span!.end)).toBe("don't like");
  });
  it("returns null when nothing resembles the variant", () => {
    expect(findErrorSpan("Completely unrelated words here.", normalize("doesn't like"))).toBeNull();
  });
  it("returns null for an empty variant", () => {
    expect(findErrorSpan("She don't like vegetables.", "")).toBeNull();
  });
});
