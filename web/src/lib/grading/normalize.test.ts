import { describe, it, expect } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  it("lowercases, trims, collapses whitespace, strips trailing punctuation, fixes smart quotes", () => {
    expect(normalize("  Doesn’t like. ")).toBe("doesn't like");
  });

  it("preserves internal slashes (alternate answers)", () => {
    expect(normalize("Is / coming")).toBe("is / coming");
  });

  it("collapses runs of whitespace to a single space", () => {
    expect(normalize("is   \t raining")).toBe("is raining");
  });

  it("normalizes smart double quotes to straight quotes", () => {
    expect(normalize("“hello”")).toBe('"hello"');
  });

  it("strips only trailing sentence punctuation, not internal", () => {
    expect(normalize("well, done!")).toBe("well, done");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalize("   ")).toBe("");
  });
});
