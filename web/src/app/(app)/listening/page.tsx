import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

function formatDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return `~${m} phút`;
}

export default async function ListeningHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Only PRACTICE-kind sets are browsable here — PLACEMENT sets are consumed
  // exclusively through the onboarding placement wizard (Task 13).
  const sets = await db.listeningSet.findMany({
    where: { kind: "PRACTICE" },
    orderBy: { slug: "asc" },
    select: { slug: true, title: true, durationSec: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Luyện nghe</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Nghe hội thoại, trả lời câu hỏi và xem transcript sau khi hoàn thành.
      </p>

      {sets.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Chưa có bài nghe nào.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sets.map((set) => (
            <Link
              key={set.slug}
              href={`/listening/${set.slug}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
                🎧
              </div>
              <div className="flex-1">
                <p className="font-medium">{set.title}</p>
                {set.durationSec && (
                  <p className="text-caption text-muted-foreground">{formatDuration(set.durationSec)}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
