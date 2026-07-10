// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { PlacementWizard } from "@/components/PlacementWizard";

const listening = {
  audioUrl: "/audio/placement.mp3",
  durationSec: 300,
  sections: [
    {
      label: "Section 1",
      title: "At the Library",
      instructions: "Nghe và chọn đáp án đúng.",
      questions: [
        {
          id: "q1",
          number: 1,
          prompt: "What time does the library close?",
          options: [
            { label: "A", text: "6 p.m." },
            { label: "B", text: "8 p.m." },
          ],
          kind: "MULTIPLE_CHOICE" as const,
          isOpenEnded: false,
        },
      ],
    },
  ],
};

test("mở ở bước Nghe và render câu hỏi listening", () => {
  render(
    <PlacementWizard
      listening={listening}
      readingMd="# Reading"
      readingSections={[]}
      writingPromptMd="Write 150 words."
      onFinished={vi.fn()}
    />,
  );
  expect(screen.getByText("Nghe")).toBeDefined();
  expect(screen.getByText(/What time does the library close/)).toBeDefined();
});

test("render được mà không cần router — không ném lỗi", () => {
  expect(() =>
    render(
      <PlacementWizard
        listening={null}
        readingMd="# Reading"
        readingSections={[]}
        writingPromptMd="Write 150 words."
        onFinished={vi.fn()}
      />,
    ),
  ).not.toThrow();
});
