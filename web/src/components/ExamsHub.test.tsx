// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExamsHub, type ExamType } from "./ExamsHub";

const EXAMS: ExamType[] = [
  {
    key: "ielts",
    name: "IELTS",
    subtitle: "30 đề · 30 đề đủ nội dung",
    description: "Reading, Writing và Speaking.",
    href: "/ielts",
  },
  {
    key: "toeic",
    name: "TOEIC",
    subtitle: "3 đề · sắp có",
    description: "Listening & Reading.",
    href: null,
    badge: "Sắp có",
    icon: "file",
  },
];

describe("ExamsHub", () => {
  it("links the enabled exam type", () => {
    render(<ExamsHub examTypes={EXAMS} linkComponent="a" />);
    const ielts = screen.getByRole("link", { name: /IELTS/ });
    expect(ielts.getAttribute("href")).toBe("/ielts");
  });

  it("renders a coming-soon exam type as a non-link", () => {
    render(<ExamsHub examTypes={EXAMS} linkComponent="a" />);
    expect(screen.queryByRole("link", { name: /TOEIC/ })).toBeNull();
    expect(screen.getByText("TOEIC")).toBeTruthy();
    expect(screen.getByText("Sắp có")).toBeTruthy();
  });

  // The hub is a chooser, not a scoreboard: no band is ever shown here.
  it("shows no band", () => {
    render(<ExamsHub examTypes={EXAMS} linkComponent="a" />);
    expect(screen.queryByText(/Band/)).toBeNull();
  });

  it("notes that more exam types are coming", () => {
    render(<ExamsHub examTypes={EXAMS} linkComponent="a" />);
    expect(screen.getByText(/Loại đề mới sẽ được thêm/)).toBeTruthy();
  });
});
