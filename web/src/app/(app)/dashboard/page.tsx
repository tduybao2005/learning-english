import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { LessonMap } from "@/components/LessonMap";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { prompt } = await searchParams;

  const [phases, states] = await Promise.all([
    db.phase.findMany({
      orderBy: { orderIndex: "asc" },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, slug: true, title: true, orderIndex: true },
        },
      },
    }),
    getLessonStates(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Lộ trình học của bạn</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {user.name ? `Xin chào, ${user.name}! ` : "Xin chào! "}
        Tiếp tục hành trình chinh phục tiếng Anh.
      </p>

      {prompt === "placement" ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Bạn chưa làm bài kiểm tra đầu vào — làm bài để chúng tôi đánh giá đúng
            trình độ hiện tại của bạn.
          </p>
          <Link
            href="/onboarding/placement"
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
          >
            Làm bài kiểm tra đầu vào
          </Link>
        </div>
      ) : null}

      <LessonMap phases={phases} states={states} />
    </div>
  );
}
