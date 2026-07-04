import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SettingsGoalForm } from "@/components/SettingsGoalForm";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/utils";

function formatGoal(goalType: "IELTS" | "CEFR" | null, goalValue: string | null): string {
  if (!goalType || !goalValue) return "Chưa đặt mục tiêu";
  return goalType === "IELTS" ? `IELTS band ${goalValue}` : `CEFR ${goalValue}`;
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const latestAttempt = await db.placementAttempt.findFirst({
    where: { userId: user.id, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: { band: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Cài đặt</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Quản lý thông tin tài khoản và mục tiêu học tập của bạn.
      </p>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Tài khoản</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mục tiêu hiện tại</span>
              <span className="font-medium">{formatGoal(user.goalType, user.goalValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Band ước tính gần nhất</span>
              <span className="font-medium">
                {latestAttempt?.band != null ? latestAttempt.band.toFixed(1) : "Chưa làm bài kiểm tra"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thay đổi mục tiêu học tập</CardTitle>
            <CardDescription>
              Cập nhật mục tiêu để chúng tôi điều chỉnh gợi ý lộ trình học.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsGoalForm initialGoalType={user.goalType} initialGoalValue={user.goalValue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bài kiểm tra đầu vào</CardTitle>
            <CardDescription>
              Làm lại bài kiểm tra để đánh giá lại trình độ và nhận lộ trình học phù hợp hơn.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/onboarding/placement"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Làm lại bài kiểm tra đầu vào
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đăng xuất</CardTitle>
            <CardDescription>Kết thúc phiên đăng nhập hiện tại trên thiết bị này.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
