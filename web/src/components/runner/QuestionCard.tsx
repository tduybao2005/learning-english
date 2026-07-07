"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { RunnerPhase } from "@/components/runner/reducer";

/**
 * Subset of `RunnerPhase` this component actually receives: the parent
 * (`ExerciseRunner.tsx`) early-returns on `"finished"` before ever rendering
 * `QuestionCard`, so that phase never reaches here. Typed against the full
 * `RunnerPhase` anyway so `status={state.phase}` type-checks without a cast.
 */
export type QuestionStatus = RunnerPhase;

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

// Deliberately NOT the `g` flag: this module-level regex is shared across
// every question render, and `RegExp.prototype.test()` on a `g`-flagged
// regex mutates its own `lastIndex` as a side effect. That previously made
// `BLANK_RE.test(...)` below intermittently return a false negative for a
// perfectly valid blank — e.g. after matching a blank at some offset in one
// prompt, `lastIndex` could land past the blank's position in the NEXT
// prompt tested (a shorter string, or one with an earlier blank), silently
// falling through to the generic textarea input instead of the inline
// blank fields. Reproduced via a real browser run of the listening runner:
// the very first FILL_BLANK question rendered as a bare textarea in dev
// (React Strict Mode's double-render of the same component built up
// `lastIndex` on the first pass, then failed `.test()` on the second).
// `String.prototype.split()` doesn't need `g` either — the spec's
// `Symbol.split` clones the regex internally regardless of the flag.
const BLANK_RE = /_{3,}/;

/** Splits a prompt into the text segments around each `______` blank. There
 * are always `blanks.length + 1` segments (possibly empty at the ends). */
function splitOnBlanks(prompt: string): string[] {
  return prompt.split(BLANK_RE);
}

function FillBlankInputs({
  prompt,
  disabled,
  status,
  onChangeJoined,
}: {
  prompt: string;
  disabled: boolean;
  status: QuestionStatus;
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

  const isWrong = status === "incorrect";
  const isCorrectPick = status === "correct";

  return (
    <p className="text-base leading-relaxed lg:mb-6 lg:text-center lg:text-h2 lg:font-bold">
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
                "mx-1 inline-block w-28 rounded-lg border border-input bg-transparent px-2 py-1 text-center font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
                isWrong && "animate-shake border-destructive bg-destructive-bg text-destructive",
                isCorrectPick && "animate-pop border-success bg-success-bg text-success",
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
  status,
  onChangeJoined,
}: {
  prompt: string;
  options: { label: string; text: string }[];
  disabled: boolean;
  status: QuestionStatus;
  onChangeJoined: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-3 text-base leading-relaxed lg:mb-6 lg:text-center lg:text-h2 lg:font-bold">{prompt}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt.label;
          const isWrong = isSelected && status === "incorrect";
          const isCorrectPick = isSelected && status === "correct";

          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelected(opt.label);
                onChangeJoined(opt.label);
              }}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors disabled:opacity-70",
                isSelected && !isWrong && !isCorrectPick && "border-primary bg-primary/10",
                !isSelected && "border-border hover:bg-muted",
                isWrong && "animate-shake border-destructive bg-destructive-bg",
                isCorrectPick && "animate-pop border-success bg-success-bg",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  isWrong && "bg-destructive/15 text-destructive",
                  isCorrectPick && "bg-success text-success-foreground",
                  isSelected && !isWrong && !isCorrectPick && "bg-primary text-primary-foreground",
                  !isSelected && "bg-muted text-muted-foreground",
                )}
              >
                {opt.label}
              </span>
              <span>{opt.text}</span>
              {isWrong && <span className="ml-auto text-destructive">✕</span>}
              {isCorrectPick && <span className="ml-auto text-success">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextAreaAnswer({
  prompt,
  disabled,
  status,
  onChangeJoined,
}: {
  prompt: string;
  disabled: boolean;
  status: QuestionStatus;
  onChangeJoined: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const isWrong = status === "incorrect";
  const isCorrectPick = status === "correct";

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
        className={cn(
          "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
          isWrong && "animate-shake border-destructive bg-destructive-bg text-destructive",
          isCorrectPick && "animate-pop border-success bg-success-bg text-success",
        )}
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
  // Optional so pre-existing consumers that don't yet track a runner phase
  // (`ListeningRunner`, `PlacementWizard` — out of scope for this task) keep
  // compiling unchanged; they get the same neutral styling as before this
  // restyle, since "answering" never matches the wrong/correct branches below.
  status = "answering",
  onChangeInput,
}: {
  question: SafeQuestion;
  disabled: boolean;
  status?: QuestionStatus;
  onChangeInput: (value: string) => void;
}) {
  if (question.kind === "MULTIPLE_CHOICE" && question.options && question.options.length > 0) {
    return (
      <MultipleChoiceOptions
        prompt={question.prompt}
        options={question.options}
        disabled={disabled}
        status={status}
        onChangeJoined={onChangeInput}
      />
    );
  }

  if (question.kind === "FILL_BLANK" && BLANK_RE.test(question.prompt)) {
    return (
      <FillBlankInputs prompt={question.prompt} disabled={disabled} status={status} onChangeJoined={onChangeInput} />
    );
  }

  return (
    <TextAreaAnswer prompt={question.prompt} disabled={disabled} status={status} onChangeJoined={onChangeInput} />
  );
}
