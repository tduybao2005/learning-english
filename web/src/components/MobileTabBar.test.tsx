// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileTabBar } from "./MobileTabBar";

describe("MobileTabBar", () => {
  it("renders the four hub tabs", () => {
    render(<MobileTabBar linkComponent="a" activePath="/dashboard" />);
    expect(screen.getByRole("link", { name: /Trang chủ/ }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: /Luyện nghe/ }).getAttribute("href")).toBe("/listening");
    expect(screen.getByRole("link", { name: /IELTS/ }).getAttribute("href")).toBe("/ielts");
    expect(screen.getByRole("link", { name: /Cài đặt/ }).getAttribute("href")).toBe("/settings");
  });

  it("marks the tab owning the current route", () => {
    render(<MobileTabBar linkComponent="a" activePath="/listening/bai-01" />);
    expect(screen.getByRole("link", { name: /Luyện nghe/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Trang chủ/ }).getAttribute("aria-current")).toBeNull();
  });
});
