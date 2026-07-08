// web/src/app/dashboard/page.tsx  (hoặc dùng làm <DashboardTimeline/>)
// Timeline dọc các giai đoạn + node bài học. Bố cục mobile-first;
// ≥lg hiển thị 2 cột (timeline + panel phụ).
"use client"
import { LessonNode, type LessonStatus } from "@/components/lesson-node"
import { Button } from "@/components/ui/button"

type Phase = {
  title: string
  done: number
  total: number
  state: "done" | "active" | "locked"
  lessons?: { label: string; status: LessonStatus }[]
}

const PHASES: Phase[] = [
  { title: "GĐ 1 · Khởi động A2", done: 10, total: 10, state: "done" },
  {
    title: "GĐ 2 · Nền tảng B1", done: 4, total: 12, state: "active",
    lessons: [
      { label: "Bài 3", status: "done" },
      { label: "Bài 4", status: "unlocked" },
      { label: "Bài 5", status: "locked" },
      { label: "Bài 6", status: "skipped" },
    ],
  },
  { title: "GĐ 3 · Phát triển B1+", done: 0, total: 14, state: "locked" },
  { title: "GĐ 4 · Hướng B2", done: 0, total: 16, state: "locked" },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-6 lg:py-8">
      {/* header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-[26px]">Chào Nguyên 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mục tiêu Band 6.5 · còn 34% chặng đường</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-streak-bg px-3.5 py-2 text-sm font-bold text-streak-foreground">
          <span className="[animation:var(--animate-flame)]">🔥</span> 12 ngày
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* timeline */}
        <div className="relative pl-7">
          <div className="absolute bottom-2 left-2.5 top-2 w-0.5 bg-border" />
          <div className="flex flex-col gap-4">
            {PHASES.map((p) => (
              <div key={p.title} className="relative">
                <span
                  className={[
                    "absolute -left-[26px] top-4 grid size-5 place-items-center rounded-full border-[3px] border-background text-[10px] font-extrabold",
                    p.state === "done" ? "bg-success text-success-foreground" : "",
                    p.state === "active" ? "bg-primary shadow-[0_0_0_4px_--theme(--color-primary/15%)]" : "",
                    p.state === "locked" ? "bg-border" : "",
                  ].join(" ")}
                >
                  {p.state === "done" ? "✓" : p.state === "locked" ? "🔒" : ""}
                </span>

                <div
                  className={[
                    "rounded-lg p-4",
                    p.state === "active"
                      ? "border-2 border-primary bg-primary/[.06]"
                      : "border border-border bg-card",
                    p.state === "locked" ? "opacity-70" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${p.state === "active" ? "text-primary" : p.state === "locked" ? "text-muted-foreground" : ""}`}>
                      {p.title}
                    </span>
                    <span className={`text-xs font-bold ${p.state === "done" ? "text-success" : p.state === "active" ? "text-primary" : "text-muted-foreground"}`}>
                      {p.done}/{p.total}
                    </span>
                  </div>

                  {(p.state === "done" || p.state === "active") && (
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${p.state === "done" ? "bg-success" : "bg-primary"}`}
                        style={{ width: `${(p.done / p.total) * 100}%` }}
                      />
                    </div>
                  )}

                  {p.lessons && (
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {p.lessons.map((l) => (
                        <LessonNode key={l.label} label={l.label} status={l.status} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* side panel (ẩn ở mobile qua thứ tự tự nhiên; hiện đẹp ở lg) */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-xl bg-primary p-5 text-primary-foreground">
            <div className="text-sm opacity-85">Việc hôm nay</div>
            <div className="mb-3.5 mt-2 text-lg font-extrabold">Bài 4 · Present Perfect</div>
            <Button variant="outline" className="w-full bg-card text-primary">Tiếp tục học →</Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4.5">
            <div className="mb-3.5 text-sm font-bold">Tuần này</div>
            {[["XP kiếm được", "340"], ["Bài hoàn thành", "6"], ["Từ vựng mới", "28"]].map(([k, v]) => (
              <div key={k} className="mb-3 flex justify-between last:mb-0">
                <span className="text-sm text-muted-foreground">{k}</span>
                <span className="text-sm font-extrabold">{v}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
