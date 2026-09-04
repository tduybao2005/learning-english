import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { MarkdownContent } from "@/components/MarkdownContent";
import { AnswerKeyAccordion } from "@/components/AnswerKeyAccordion";
import { sliceAnswerKeyBySkill, type IeltsSkill } from "@/lib/ielts-answer-key";
import { splitReadingPaper } from "@/lib/ielts-reading";
import {
  IeltsReadingRunner,
  type RunnerPassage,
} from "@/components/IeltsReadingRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

function TabBody({ content, emptyLabel }: { content: string; emptyLabel: string }) {
  if (content.trim().length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }
  return <MarkdownContent content={content} />;
}

const SKILL_META = {
  reading: { label: "Reading", empty: "Đề này chưa có phần Reading." },
  writing: { label: "Writing", meta: "2 bài · 60 phút", empty: "Đề này chưa có phần Writing." },
  speaking: { label: "Speaking", meta: "3 phần · 11-14 phút", empty: "Đề này chưa có phần Speaking." },
} as const;

export default async function IeltsTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ skill?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { n } = await params;
  const number = Number(n);
  if (!Number.isInteger(number)) notFound();

  // Câu hỏi kèm theo, NHƯNG không kèm `variants`/`answerRaw`: đáp án không được
  // rời DB trước khi nộp — nếu chúng đi theo HTML thì mở DevTools là thấy hết, và
  // bài thi mất nghĩa (đúng lỗi của bản cũ với AnswerKeyAccordion).
  const test = await db.ieltsTest.findUnique({
    where: { number },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        include: {
          questions: {
            orderBy: { number: "asc" },
            select: { id: true, number: true, prompt: true, options: true, isOpenEnded: true },
          },
        },
      },
    },
  });
  if (!test) notFound();

  const { skill } = await searchParams;
  const activeSkill: IeltsSkill = skill === "writing" || skill === "speaking" ? skill : "reading";
  const content = { reading: test.readingMd, writing: test.writingMd, speaking: test.speakingMd }[activeSkill];

  // Đề chấm được = key đã qua cổng kiểm tra VÀ đã seed đủ câu hỏi.
  const dbQuestions = test.sections.flatMap((s) =>
    s.questions.map((q) => ({
      ...q,
      kind: s.kind as SafeQuestion["kind"],
    })),
  );
  const paper = activeSkill === "reading" ? splitReadingPaper(test.readingMd) : null;
  const gradeable =
    activeSkill === "reading" && test.readingKeyVerified && dbQuestions.length > 0 && paper !== null;

  let runnerPassages: RunnerPassage[] = [];
  if (gradeable && paper) {
    const byNumber = new Map(dbQuestions.map((q) => [q.number, q]));
    runnerPassages = paper.passages.map((p) => ({
      title: p.title,
      passageMd: p.passageMd,
      groups: p.groups.map((g) => ({
        title: g.title,
        instructionsMd: g.instructionsMd,
        questions: Array.from({ length: g.to - g.from + 1 }, (_, i) => byNumber.get(g.from + i))
          .filter((q): q is NonNullable<typeof q> => q !== undefined)
          .map(
            (q): SafeQuestion => ({
              id: q.id,
              number: q.number,
              prompt: q.prompt,
              kind: q.kind,
              options: (q.options as SafeQuestion["options"]) ?? null,
              isOpenEnded: q.isOpenEnded,
            }),
          ),
      })),
    }));
  }

  return (
    <div className={cn("mx-auto px-4 py-8", gradeable ? "max-w-6xl" : "max-w-3xl")}>
      <Link
        href={`/ielts?skill=${activeSkill}`}
        className="press-btn mb-4 inline-block text-sm text-muted-foreground transition-all hover:text-foreground"
      >
        ← Quay lại đề {SKILL_META[activeSkill].label}
      </Link>

      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-h1 font-extrabold">Đề {String(test.number).padStart(2, "0")}</h1>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {SKILL_META[activeSkill].label}
        </span>
        {!test.isComplete && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Chưa đủ nội dung
          </span>
        )}
      </div>
      {activeSkill !== "reading" && (
        <p className="mb-6 text-caption text-muted-foreground">{SKILL_META[activeSkill].meta}</p>
      )}
      {activeSkill === "reading" && <div className="mb-6" />}

      {gradeable ? (
        <IeltsReadingRunner
          testNumber={test.number}
          passages={runnerPassages}
          totalQuestions={dbQuestions.length}
        />
      ) : (
        <>
          {activeSkill === "reading" && (
            // 10 đề có answer key trả lời những câu mà chính đề không hỏi
            // (scripts/check_ielts_keys.py). Không chấm được, và cũng không được
            // giả vờ chấm — nói thẳng ra, giữ trang ở dạng đọc.
            <p className="mb-4 rounded-xl border border-streak-foreground/30 bg-streak-bg p-4 text-sm text-streak-foreground">
              Đề này chưa chấm tự động được: đáp án gốc của đề có sai lệch so với chính đề bài.
              Bạn vẫn đọc và tự luyện được, nhưng chưa có nút nộp bài.
            </p>
          )}
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <TabBody content={content} emptyLabel={SKILL_META[activeSkill].empty} />
          </div>
          {/* Chỉ Writing/Speaking (và Reading chưa chấm được) còn accordion: hai kỹ
              năng đó không có đáp án khách quan để chấm, model answer là thứ duy
              nhất có ích. Reading chấm được thì KHÔNG accordion — nó lộ đáp án
              trước khi làm bài. */}
          <AnswerKeyAccordion answerKeyMd={sliceAnswerKeyBySkill(test.answerKeyMd, activeSkill)} />
        </>
      )}
    </div>
  );
}
