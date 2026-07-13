import NextLink from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { ExamsHub, type ExamType } from "@/components/ExamsHub";

/** `/exams` — the "Đề thi" hub. Holds IELTS today; TOEIC content exists in the
 * repo (`toeic_practice_tests/`) but has no routes/seed yet, so it is a muted
 * placeholder. Same query as `(app)/ielts/page.tsx`: the flag + number only,
 * never the markdown blobs. */
export default async function ExamsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tests = await db.ieltsTest.findMany({
    orderBy: { number: "asc" },
    select: { number: true, isComplete: true },
  });

  // No band is shown here: the placement band says nothing about how the user
  // performs on these tests, and there is no per-user IELTS attempt table yet
  // (the schema has ExerciseAttempt and PlacementAttempt only), so "đã làm" has
  // no source either. The hub stays purely a chooser.
  const examTypes: ExamType[] = [
    {
      key: "ielts",
      name: "IELTS",
      subtitle: `${tests.length} đề · ${tests.filter((t) => t.isComplete).length} đề đủ nội dung`,
      description: "Reading, Writing và Speaking, chấm theo thang band 0–9.",
      href: "/ielts",
      icon: "graduation",
    },
    {
      key: "toeic",
      name: "TOEIC",
      subtitle: "3 đề · sắp có",
      description: "Listening & Reading theo thang 5–495 mỗi kỹ năng.",
      href: null,
      badge: "Sắp có",
      icon: "file",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-6xl">
      <ExamsHub examTypes={examTypes} linkComponent={NextLink} />
    </div>
  );
}
