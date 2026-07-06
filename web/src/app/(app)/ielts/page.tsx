import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export default async function IeltsHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // List page only needs the flag + number — never pull the markdown blobs
  // here (that's the [n] detail page's job).
  const tests = await db.ieltsTest.findMany({
    orderBy: { number: "asc" },
    select: { number: true, isComplete: true },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-h1 font-extrabold">Đề luyện IELTS</h1>
      <p className="mb-6 text-body text-muted-foreground">
        {tests.length} đề luyện thi đầy đủ 4 kỹ năng: Reading, Writing, Speaking và đáp án tham khảo.
      </p>

      {tests.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Chưa có đề luyện thi nào"
          description="Quay lại sau để luyện đề IELTS nhé."
        />
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {tests.map((test) => (
            <Link
              key={test.number}
              href={`/ielts/${test.number}`}
              className={cn(
                "aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-center transition-colors hover:bg-muted/50",
                !test.isComplete && "opacity-60 hover:opacity-80",
              )}
            >
              <p className="text-h2 font-bold">{test.number}</p>
              {!test.isComplete && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                  Chưa đủ nội dung
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
