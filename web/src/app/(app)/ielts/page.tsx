import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
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
      <h1 className="mb-1 text-2xl font-bold">Đề luyện thi IELTS</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {tests.length} đề luyện thi đầy đủ 4 kỹ năng: Reading, Writing, Speaking và đáp án tham khảo.
      </p>

      {tests.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Chưa có đề luyện thi nào.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tests.map((test) => (
            <Link
              key={test.number}
              href={`/ielts/${test.number}`}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:bg-muted/50",
                !test.isComplete && "opacity-60 hover:opacity-80",
              )}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpen className="size-5" />
              </div>
              <p className="font-medium">Đề {test.number}</p>
              {!test.isComplete && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
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
