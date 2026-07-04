"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type SafeQuestionKind =
  | "FILL_BLANK"
  | "MULTIPLE_CHOICE"
  | "TRANSFORMATION"
  | "ERROR_CORRECTION"
  | "TRANSLATION"
  | "OPEN_WRITING";

export interface SafeQuestion {
  id: string;
  number: number;
  prompt: string;
  options: { label: string; text: string }[] | null;
  kind: SafeQuestionKind;
  isOpenEnded: boolean;
}

const BLANK_RE = /_{3,}/g;

/** Splits a prompt into the text segments around each `______` blank. There
 * are always `blanks.length + 1` segments (possibly empty at the ends). */
function splitOnBlanks(prompt: string): string[] {
  return prompt.split(BLANK_RE);
}

function FillBlankInputs({
  prompt,
  disabled,
  onChangeJoined,
}: {
  prompt: string;
  disabled: boolean;
  onChangeJoined: (value: string) => void;
}) {
  const segments = splitOnBlanks(prompt);
  const blankCount = segments.length - 1;
  const [values, setValues] = useState<string[]>(() => Array(blankCount).fill(""));

  function update(i: number, value: string) {
    const next = [...values];
    next[i] = value;
    setValues(next);
    // Multiple blanks in one question are joined into a single ordered
    // answer (" / "-separated) to match how the seed data stores their
    // AnswerVariant — see `scripts/seed/parse-exercise.ts`'s `variantsFillBlank`.
    onChangeJoined(blankCount >= 2 ? next.join(" / ") : (next[0] ?? ""));
  }

  return (
    <p className="text-base leading-relaxed">
      {segments.map((segment, i) => (
        <span key={i}>
          {segment}
          {i < blankCount && (
            <input
              type="text"
              value={values[i]}
              disabled={disabled}
              onChange={(e) => update(i, e.target.value)}
              className={cn(
                "mx-1 inline-block w-28 rounded border border-input bg-transparent px-1.5 py-0.5 text-center text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
              )}
            />
          )}
        </span>
      ))}
    </p>
  );
}

function MultipleChoiceOptions({
  prompt,
  options,
  disabled,
  onChangeJoined,
}: {
  prompt: string;
  options: { label: string; text: string }[];
  disabled: boolean;
  onChangeJoined: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-3 text-base leading-relaxed">{prompt}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            disabled={disabled}
            onClick={() => {
              setSelected(opt.label);
              onChangeJoined(opt.label);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60",
              selected === opt.label
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-medium">
              {opt.label}
            </span>
            <span>{opt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TextAreaAnswer({
  prompt,
  disabled,
  onChangeJoined,
}: {
  prompt: string;
  disabled: boolean;
  onChangeJoined: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div>
      <p className="mb-3 whitespace-pre-line text-base leading-relaxed">{prompt}</p>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          onChangeJoined(e.target.value);
        }}
        rows={3}
        placeholder="Nhập câu trả lời của bạn..."
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
      />
    </div>
  );
}

/**
 * Renders the current question's prompt with a per-kind answer input.
 * Uncontrolled with respect to the parent's reducer `input` string: it keeps
 * its own local UI state and reports the composed answer text up via
 * `onChangeInput` on every change. The parent remounts this component (via
 * `key={question.id}`) whenever the question changes, so local state always
 * starts fresh.
 */
export function QuestionCard({
  question,
  disabled,
  onChangeInput,
}: {
  question: SafeQuestion;
  disabled: boolean;
  onChangeInput: (value: string) => void;
}) {
  if (question.kind === "MULTIPLE_CHOICE" && question.options && question.options.length > 0) {
    return (
      <MultipleChoiceOptions
        prompt={question.prompt}
        options={question.options}
        disabled={disabled}
        onChangeJoined={onChangeInput}
      />
    );
  }

  if (question.kind === "FILL_BLANK" && BLANK_RE.test(question.prompt)) {
    return <FillBlankInputs prompt={question.prompt} disabled={disabled} onChangeJoined={onChangeInput} />;
  }

  return <TextAreaAnswer prompt={question.prompt} disabled={disabled} onChangeJoined={onChangeInput} />;
}
