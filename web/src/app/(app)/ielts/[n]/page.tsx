import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { MarkdownContent } from "@/components/MarkdownContent";
import { AnswerKeyAccordion } from "@/components/AnswerKeyAccordion";
import { sliceAnswerKeyBySkill, type IeltsSkill } from "@/lib/ielts-answer-key";
import { splitReadingSections } from "@/lib/ielts-reading";

function TabBody({ content, emptyLabel }: { content: string; emptyLabel: string }) {
  if (content.trim().length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }
  return <MarkdownContent content={content} />;
}

const SKILL_META = {
  reading: { label: "Reading", meta: "40 câu · 60 phút", empty: "Đề này chưa có phần Reading." },
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

  const test = await db.ieltsTest.findUnique({ where: { number } });
  if (!test) notFound();

  const { skill } = await searchParams;
  const activeSkill: IeltsSkill = skill === "writing" || skill === "speaking" ? skill : "reading";
  const content = { reading: test.readingMd, writing: test.writingMd, speaking: test.speakingMd }[activeSkill];
  const readingSections = activeSkill === "reading" ? splitReadingSections(test.readingMd) : null;

  return (
    <div
      className={cn(
        "mx-auto px-4 py-8",
        activeSkill === "reading" && readingSections ? "max-w-6xl" : "max-w-3xl",
      )}
    >
      <Link
        href={`/ielts?skill=${activeSkill}`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
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
      <p className="mb-6 text-caption text-muted-foreground">{SKILL_META[activeSkill].meta}</p>

      {activeSkill === "reading" && readingSections ? (
        <div className="mb-6 flex flex-col gap-6">
          {readingSections.intro && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <MarkdownContent content={readingSections.intro} />
            </div>
          )}
          {readingSections.pairs.map((pair, i) => (
            <div key={i} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <MarkdownContent content={pair.passageMd} />
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <MarkdownContent content={pair.questionsMd} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <TabBody content={content} emptyLabel={SKILL_META[activeSkill].empty} />
        </div>
      )}

      <AnswerKeyAccordion answerKeyMd={sliceAnswerKeyBySkill(test.answerKeyMd, activeSkill)} />
    </div>
  );
}
