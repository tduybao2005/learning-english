import NextLink from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/EmptyState";
import { IeltsHub } from "@/components/IeltsHub";

export default async function IeltsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // List page only needs the flag + number — never pull the markdown blobs
  // here (that's the [n] detail page's job).
  const tests = await db.ieltsTest.findMany({
    orderBy: { number: "asc" },
    select: { number: true, isComplete: true },
  });

  const { skill } = await searchParams;
  const initialSkill = skill === "writing" || skill === "speaking" ? skill : "reading";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-6xl">
      {tests.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Chưa có đề luyện thi nào"
          description="Quay lại sau để luyện đề IELTS nhé."
          linkComponent={NextLink}
        />
      ) : (
        <IeltsHub tests={tests} initialSkill={initialSkill} />
      )}
    </div>
  );
}
