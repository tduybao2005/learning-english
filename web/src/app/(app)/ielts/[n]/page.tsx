import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { MarkdownContent } from "@/components/MarkdownContent";
import { AnswerKeyAccordion } from "@/components/AnswerKeyAccordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function TabBody({ content, emptyLabel }: { content: string; emptyLabel: string }) {
  if (content.trim().length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }
  return <MarkdownContent content={content} />;
}

export default async function IeltsTestPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { n } = await params;
  const number = Number(n);
  if (!Number.isInteger(number)) notFound();

  const test = await db.ieltsTest.findUnique({ where: { number } });
  if (!test) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/ielts" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Quay lại danh sách đề
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Đề luyện thi IELTS — Đề {test.number}</h1>
        {!test.isComplete && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Chưa đủ nội dung
          </span>
        )}
      </div>

      <Tabs defaultValue="reading" className="mb-6">
        <TabsList className="w-full">
          <TabsTrigger value="reading" className="flex-1">
            Reading
          </TabsTrigger>
          <TabsTrigger value="writing" className="flex-1">
            Writing
          </TabsTrigger>
          <TabsTrigger value="speaking" className="flex-1">
            Speaking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reading" className="mt-4">
          <TabBody content={test.readingMd} emptyLabel="Đề này chưa có phần Reading." />
        </TabsContent>
        <TabsContent value="writing" className="mt-4">
          <TabBody content={test.writingMd} emptyLabel="Đề này chưa có phần Writing." />
        </TabsContent>
        <TabsContent value="speaking" className="mt-4">
          <TabBody content={test.speakingMd} emptyLabel="Đề này chưa có phần Speaking." />
        </TabsContent>
      </Tabs>

      <AnswerKeyAccordion answerKeyMd={test.answerKeyMd} />
    </div>
  );
}
