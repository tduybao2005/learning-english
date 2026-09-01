import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { getSessionUser } from "@/lib/auth/session";
import { SettingsGoalFormConnected } from "@/components/SettingsGoalFormConnected";
import { SettingsNameEditorConnected } from "@/components/SettingsNameEditorConnected";
import { LogoutButtonConnected } from "@/components/LogoutButtonConnected";
import { ThemeToggleRowConnected } from "@/components/ThemeToggleRowConnected";

function formatGoal(goalType: "IELTS" | "CEFR" | "TOEIC" | null, goalValue: string | null): string {
  if (!goalType || !goalValue) return "Chưa đặt mục tiêu";
  if (goalType === "IELTS") return `IELTS band ${goalValue}`;
  if (goalType === "TOEIC") return `TOEIC ${goalValue}`;
  return `CEFR ${goalValue}`;
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const avatarLetter = (user.name ?? user.email).charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-3xl">
      <h1 className="mb-1 text-h1 font-extrabold">Cài đặt</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Quản lý thông tin tài khoản và mục tiêu học tập của bạn.
      </p>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-primary-glow">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">
              {avatarLetter}
            </span>
            <div className="min-w-0">
              {/* Tên + email là đủ: dòng "band ước tính" đi cùng bài kiểm tra
                  đầu vào, mà bài đó đã được ẩn khỏi giao diện. */}
              <SettingsNameEditorConnected initialName={user.name} email={user.email} />
            </div>
          </div>
        </div>

        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-secondary text-base">
                🎯
              </span>
              <span>
                <p className="text-sm font-semibold">Mục tiêu học</p>
                <p className="text-xs text-muted-foreground">{formatGoal(user.goalType, user.goalValue)}</p>
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border px-4 py-4">
            <SettingsGoalFormConnected initialGoalType={user.goalType} initialGoalValue={user.goalValue} />
          </div>
        </details>

        <ThemeToggleRowConnected />

        <LogoutButtonConnected variant="destructive" className="w-full max-lg:min-h-11" />
      </div>
    </div>
  );
}
