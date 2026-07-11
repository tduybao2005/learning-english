// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

import { ListeningSetView } from "@/components/ListeningSetView";
import type { SafeListeningSection } from "@/components/runner/section-runner";

const sections: SafeListeningSection[] = [
  {
    label: "Section 1",
    title: "At the Library",
    instructions: "Nghe và điền vào chỗ trống.",
    audioUrl: "/audio/section-1.mp3",
    questions: [
      { id: "q1", number: 1, prompt: "The library closes at ______.", options: null, kind: "FILL_BLANK", isOpenEnded: false },
    ],
  },
  {
    label: "Section 2",
    title: "At the Cafe",
    instructions: "Nghe và điền vào chỗ trống.",
    audioUrl: "/audio/section-2.mp3",
    questions: [
      { id: "q2", number: 1, prompt: "The cafe closes at ______.", options: null, kind: "FILL_BLANK", isOpenEnded: false },
    ],
  },
];

const transcriptMd = [
  "NARRATOR: Section 1. At the library.",
  "STAFF: We close at 8pm.",
  "NARRATOR: Section 2. At the cafe.",
  "STAFF: We close at 9pm.",
].join("\n");

function mockFetchByQuestion(results: Record<string, { correct: boolean }>) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    return { json: async () => results[body.questionId] ?? { correct: true } } as Response;
  });
}

const btn = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

async function answerAndSubmit(value: string) {
  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value } });
  fireEvent.click(btn("Nộp phần"));
  await screen.findByRole("button", { name: "Tiếp tục" });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

test("audio rail follows the current section's clip and unlocks its transcript on submit; Làm lại re-locks + resets audio", async () => {
  vi.stubGlobal("fetch", mockFetchByQuestion({ q1: { correct: true }, q2: { correct: true } }));

  const { container } = render(
    <ListeningSetView
      slug="test-set"
      audioUrl="/audio/full-set.mp3"
      transcriptMd={transcriptMd}
      sections={sections}
    />,
  );

  const audio = () => container.querySelector("audio") as HTMLAudioElement;
  expect(audio().getAttribute("src")).toBe("/audio/section-1.mp3");

  // Transcript for section 1 is locked before submit.
  expect(screen.queryByText(/We close at 8pm/)).toBeNull();

  await answerAndSubmit("8pm");

  // Submitting section 1 unlocks its transcript chunk immediately.
  expect((await screen.findAllByText(/We close at 8pm/)).length).toBeGreaterThan(0);

  fireEvent.click(btn("Tiếp tục"));

  // Advancing to section 2 swaps the audio clip.
  expect(audio().getAttribute("src")).toBe("/audio/section-2.mp3");

  await answerAndSubmit("9pm");
  fireEvent.click(btn("Tiếp tục"));

  await screen.findByText(/Hoàn thành cả 2 phần/);

  fireEvent.click(btn("Làm lại"));

  // Re-locked and back to section 1's clip.
  expect(audio().getAttribute("src")).toBe("/audio/section-1.mp3");
  expect(screen.queryByText(/We close at 8pm/)).toBeNull();
  expect(screen.queryByText(/We close at 9pm/)).toBeNull();
});

test("a section with no audioUrl falls back to the set-level audioUrl", () => {
  const sectionsWithoutAudio: SafeListeningSection[] = [
    { ...sections[0], audioUrl: null },
    { ...sections[1], audioUrl: null },
  ];

  const { container } = render(
    <ListeningSetView
      slug="test-set"
      audioUrl="/audio/full-set.mp3"
      transcriptMd={transcriptMd}
      sections={sectionsWithoutAudio}
    />,
  );

  const audio = container.querySelector("audio") as HTMLAudioElement;
  expect(audio.getAttribute("src")).toBe("/audio/full-set.mp3");
});
