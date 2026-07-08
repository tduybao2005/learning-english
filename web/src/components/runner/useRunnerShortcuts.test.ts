import { describe, expect, it } from "vitest";
import { moveIndex } from "./useRunnerShortcuts";

describe("moveIndex", () => {
  it("moves right and clamps at the last field", () => {
    expect(moveIndex(0, 1, 3)).toBe(1);
    expect(moveIndex(2, 1, 3)).toBe(2);
  });
  it("moves left and clamps at the first field", () => {
    expect(moveIndex(1, -1, 3)).toBe(0);
    expect(moveIndex(0, -1, 3)).toBe(0);
  });
  it("enters at the first field when nothing is focused (-1)", () => {
    expect(moveIndex(-1, 1, 3)).toBe(0);
    expect(moveIndex(-1, -1, 3)).toBe(0);
  });
});
