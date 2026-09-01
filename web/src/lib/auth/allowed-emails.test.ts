import { describe, expect, it } from "vitest";

import { isAllowedEmail } from "./allowed-emails";

describe("isAllowedEmail", () => {
  it("allows any email when ALLOWED_EMAILS is unset (unrestricted by default)", () => {
    expect(isAllowedEmail("stranger@gmail.com", undefined)).toBe(true);
  });

  it("allows any email when ALLOWED_EMAILS is blank", () => {
    expect(isAllowedEmail("stranger@gmail.com", "  ")).toBe(true);
  });

  it("allows an email present in the list", () => {
    expect(isAllowedEmail("t.dbao.ron@gmail.com", "t.dbao.ron@gmail.com")).toBe(true);
  });

  it("rejects an email not present in the list", () => {
    expect(isAllowedEmail("stranger@gmail.com", "t.dbao.ron@gmail.com")).toBe(false);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isAllowedEmail("  T.DBAO.RON@GMAIL.COM  ", "t.dbao.ron@gmail.com")).toBe(true);
  });

  it("supports multiple comma-separated emails", () => {
    expect(isAllowedEmail("b@b.com", "a@a.com, b@b.com")).toBe(true);
    expect(isAllowedEmail("c@c.com", "a@a.com, b@b.com")).toBe(false);
  });
});
