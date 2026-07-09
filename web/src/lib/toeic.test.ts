import { describe, it, expect } from "vitest";

import { rawToToeicListening } from "./toeic";

describe("rawToToeicListening", () => {
  it("floors at 5 and caps at 495", () => {
    expect(rawToToeicListening(0)).toBe(5);
    expect(rawToToeicListening(100)).toBe(495);
  });

  it("maps mid-range raw scores to published-style estimates", () => {
    expect(rawToToeicListening(50)).toBe(255);
    expect(rawToToeicListening(75)).toBe(385);
  });

  it("clamps out-of-range input", () => {
    expect(rawToToeicListening(-3)).toBe(5);
    expect(rawToToeicListening(120)).toBe(495);
  });
});
