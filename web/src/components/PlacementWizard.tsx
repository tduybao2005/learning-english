"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AudioPlayer } from "@/components/AudioPlayer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { QuestionCard, type SafeQuestion } from "@/components/runner/QuestionCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReadingSectionProp {
  label: string;
  title: string;
  instructions: string | null;
  questions: SafeQuestion[];
}

interface ListeningProp {
  audioUrl: string;
  questions: SafeQuestion[];
}

type AnswerMap = Record<string, string>;
type ResultMap = Record<string, { text: string; isCorrect: boolean }>;

type Step = "listening" | "reading" | "writing";

const STEPS: { key: Step; label: string }[] = [
  { key: "listening", label: "Nghe" },
  { key: "reading", label: "Đọc" },
  { key: "writing", label: "Viết" },
];

const MIN_WRITING_WORDS = 150;

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                i < currentIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : i === currentIndex
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                i <= currentIndex ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("mx-2 h-0.5 flex-1", i < currentIndex ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Renders every question in a section at once (batch, single submit — no
 * per-question retry, this is a test). Each `QuestionCard` is uncontrolled
 * (keeps its own local input state, same as `ExerciseRunner`/
 * `ListeningRunner`) and reports its composed answer text up via
 * `onChange`, which the parent stores keyed by question id.
 */
function QuestionBatch({
  questions,
  onChange,
}: {
  questions: SafeQuestion[];
  onChange: (questionId: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {questions.map((q) => (
        <div key={q.id} className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Câu {q.number}</p>
          <QuestionCard
            question={q}
            disabled={false}
            onChangeInput={(value) => onChange(q.id, value)}
          />
        </div>
      ))}
    </div>
  );
}

export function PlacementWizard({
  listening,
  readingMd,
  readingSections,
  writingPromptMd,
}: {
  listening: ListeningProp | null;
  readingMd: string;
  readingSections: ReadingSectionProp[];
  writingPromptMd: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("listening");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listeningAnswers, setListeningAnswers] = useState<AnswerMap>({});
  const [readingAnswers, setReadingAnswers] = useState<AnswerMap>({});
  const [writingText, setWritingText] = useState("");

  const [listeningScore, setListeningScore] = useState<{ raw: number; total: number } | null>(null);
  const [readingScore, setReadingScore] = useState<{ raw: number; total: number } | null>(null);
  const [combinedResults, setCombinedResults] = useState<ResultMap>({});

  const readingQuestions = useMemo(
    () => readingSections.flatMap((s) => s.questions),
    [readingSections],
  );

  async function submitSection(section: "LISTENING" | "READING") {
    const questions = section === "LISTENING" ? listening?.questions ?? [] : readingQuestions;
    const answerMap = section === "LISTENING" ? listeningAnswers : readingAnswers;
    const answers = questions.map((q) => ({ questionId: q.id, answerText: answerMap[q.id] ?? "" }));

    const res = await fetch("/api/placement/submit-section", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section, answers }),
    });
    if (!res.ok) throw new Error("submit-section failed");
    const json: { rawScore: number; total: number; results: ResultMap } = await res.json();

    setCombinedResults((prev) => ({ ...prev, ...json.results }));
    if (section === "LISTENING") setListeningScore({ raw: json.rawScore, total: json.total });
    else setReadingScore({ raw: json.rawScore, total: json.total });
    return json;
  }

  async function handleFinishListening() {
    setError(null);
    setSubmitting(true);
    try {
      if (listening) await submitSection("LISTENING");
      else setListeningScore({ raw: 0, total: 0 });
      setStep("reading");
    } catch {
      setError("Không thể nộp phần Nghe. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinishReading() {
    setError(null);
    setSubmitting(true);
    try {
      await submitSection("READING");
      setStep("writing");
    } catch {
      setError("Không thể nộp phần Đọc. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinishAll() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/placement/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          readingScore: readingScore?.raw ?? 0,
          listeningScore: listeningScore?.raw ?? 0,
          writingText,
          answers: combinedResults,
        }),
      });
      if (!res.ok) throw new Error("complete failed");
      router.push("/onboarding/placement/result");
    } catch {
      setError("Không thể hoàn tất bài kiểm tra. Vui lòng thử lại.");
      setSubmitting(false);
    }
  }

  const words = wordCount(writingText);

  return (
    <div>
      <Stepper current={step} />
      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === "listening" && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="mb-1 text-xl font-bold">Phần Nghe (Listening)</h1>
            <p className="text-sm text-muted-foreground">
              Nghe đoạn hội thoại và trả lời 10 câu hỏi bên dưới. Bạn có thể tua lại, không giới hạn số
              lần nghe. Sau khi nộp bài, bạn sẽ không thể quay lại sửa câu trả lời.
            </p>
          </div>
          {listening ? (
            <>
              <AudioPlayer src={listening.audioUrl} />
              <QuestionBatch
                questions={listening.questions}
                onChange={(id, value) => setListeningAnswers((prev) => ({ ...prev, [id]: value }))}
              />
            </>
          ) : (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Phần nghe hiện chưa sẵn sàng — bạn có thể tiếp tục sang phần Đọc.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleFinishListening} disabled={submitting}>
              {submitting ? "Đang nộp..." : "Nộp bài & Tiếp tục"}
            </Button>
          </div>
        </div>
      )}

      {step === "reading" && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="mb-1 text-xl font-bold">Phần Đọc (Reading)</h1>
            <p className="text-sm text-muted-foreground">
              Đọc hai đoạn văn bên dưới và trả lời các câu hỏi tương ứng.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <MarkdownContent content={readingMd} />
          </div>
          {readingSections.map((section) => (
            <div key={section.label} className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-bold">{section.title}</h2>
                {section.instructions ? (
                  <p className="text-sm text-muted-foreground">{section.instructions}</p>
                ) : null}
              </div>
              <QuestionBatch
                questions={section.questions}
                onChange={(id, value) => setReadingAnswers((prev) => ({ ...prev, [id]: value }))}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button onClick={handleFinishReading} disabled={submitting}>
              {submitting ? "Đang nộp..." : "Nộp bài & Tiếp tục"}
            </Button>
          </div>
        </div>
      )}

      {step === "writing" && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="mb-1 text-xl font-bold">Phần Viết (Writing)</h1>
            <p className="text-sm text-muted-foreground">
              Viết bài luận theo đề bên dưới. Bài viết sẽ được lưu lại nhưng sẽ được chấm sau (tính năng
              chấm điểm AI sắp ra mắt) — điểm phần Viết chưa ảnh hưởng đến band xếp lớp hôm nay.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <MarkdownContent content={writingPromptMd} />
          </div>
          <div>
            <textarea
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              rows={14}
              placeholder="Viết bài luận của bạn ở đây..."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <p
              className={cn(
                "mt-1 text-xs",
                words >= MIN_WRITING_WORDS ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {words} / {MIN_WRITING_WORDS} từ tối thiểu
              {words < MIN_WRITING_WORDS ? " — nên viết đủ để được đánh giá chính xác hơn sau này." : " ✓"}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleFinishAll} disabled={submitting}>
              {submitting ? "Đang hoàn tất..." : "Hoàn thành bài kiểm tra"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
