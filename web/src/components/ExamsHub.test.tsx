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
    stat: "Band 6.5",
  },
  {
    key: "toeic",
    name: "TOEIC",
    subtitle: "3 đề · sắp có",
    description: "Listening & Reading.",
    href: null,
    stat: "Sắp có",
    icon: "file",
  },
];

describe("ExamsHub", () => {
  it("links the enabled exam type and shows its stat", () => {
    render(<ExamsHub examTypes={EXAMS} linkComponent="a" />);
    const ielts = screen.getByRole("link", { name: /IELTS/ });
    expect(ielts.getAttribute("href")).toBe("/ielts");
    expect(screen.getByText("Band 6.5")).toBeTruthy();
  });

  it("renders a coming-soon exam type as a non-link", () => {
    render(<ExamsHub examTypes={EXAMS} linkComponent="a" />);
    expect(screen.queryByRole("link", { name: /TOEIC/ })).toBeNull();
    expect(screen.getByText("TOEIC")).toBeTruthy();
    expect(screen.getByText("3 đề · sắp có")).toBeTruthy();
  });

  it("omits the stat when the user has no band", () => {
    render(
      <ExamsHub examTypes={[{ ...EXAMS[0], stat: null }]} linkComponent="a" />,
    );
    expect(screen.queryByText(/^Band /)).toBeNull();
  });
});
