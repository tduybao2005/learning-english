// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileTabBar } from "./MobileTabBar";

describe("MobileTabBar", () => {
  it("renders the five hub tabs", () => {
    render(<MobileTabBar linkComponent="a" activePath="/dashboard" />);
    const expected: [RegExp, string][] = [
      [/Lộ trình/, "/dashboard"],
      [/Từ vựng/, "/vocab"],
      [/Luyện nghe/, "/listening"],
      [/Đề thi/, "/exams"],
      [/Cài đặt/, "/settings"],
    ];
    for (const [name, href] of expected) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("marks the tab owning the current route", () => {
    render(<MobileTabBar linkComponent="a" activePath="/listening/bai-01" />);
    expect(screen.getByRole("link", { name: /Luyện nghe/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Lộ trình/ }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Đề thi active on an IELTS route, which the exams hub also owns", () => {
    render(<MobileTabBar linkComponent="a" activePath="/ielts/7" />);
    expect(screen.getByRole("link", { name: /Đề thi/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Luyện nghe/ }).getAttribute("aria-current")).toBeNull();
  });
});
