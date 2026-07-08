// web/src/components/exercise-runner.tsx
// Runner một-câu-một-lần: MCQ / điền chỗ trống, với đủ trạng thái
// idle → selected → correct (pop) / wrong (shake + keyNote + slot AI).
"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Choice = { key: string; text: string }
type Status = "idle" | "correct" | "wrong"

export function ExerciseRunner({
  index = 4, total = 10,
  prompt = "She ______ in London since 2020.",
  choices = [
    { key: "A", text: "lived" },
    { key: "B", text: "has lived" },
    { key: "C", text: "is living" },
  ],
  answer = "B",
  keyNote = '"since 2020" → mốc kéo dài đến nay ⇒ dùng present perfect (has/have + V3).',
}: {
  index?: number; total?: number; prompt?: string
  choices?: Choice[]; answer?: string; keyNote?: string
}) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<Status>("idle")

  function check() {
    if (!selected) return
    setStatus(selected === answer ? "correct" : "wrong")
  }
  function reset() { setSelected(null); setStatus("idle") }

  return (
    <div className="mx-auto flex min-h-[560px] max-w-md flex-col px-5 py-4">
      {/* progress */}
      <div className="mb-6 flex items-center gap-3">
        <button className="grid size-8 place-items-center rounded-md bg-muted text-sm">✕</button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500"
               style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">{index}/{total}</span>
      </div>

      <span className="mb-2 text-xs font-semibold text-primary">Chọn đáp án đúng</span>
      <p className="mb-5 text-lg font-bold leading-snug">{prompt}</p>

      {/* choices */}
      <div className="mb-auto flex flex-col gap-3">
        {choices.map((c) => {
          const isSel = selected === c.key
          const isAns = c.key === answer
          let tone = "border-border bg-card"
          if (status === "idle" && isSel) tone = "border-2 border-primary bg-primary/[.06] font-semibold"
          if (status === "correct" && isSel) tone = "border-2 border-success bg-success-bg font-semibold animate-[pop_320ms_ease]"
          if (status === "wrong" && isSel) tone = "border-2 border-destructive bg-destructive-bg font-semibold animate-[shake_360ms_ease]"
          if (status === "wrong" && isAns) tone = "border-2 border-success bg-success-bg font-semibold"
          return (
            <button key={c.key} onClick={() => status === "idle" && setSelected(c.key)}
              className={cn("flex items-center justify-between rounded-xl border p-4 text-left text-[15px] transition-all", tone)}>
              <span className="flex items-center gap-3">
                <span className="grid size-6.5 place-items-center rounded-lg bg-muted text-xs font-bold">{c.key}</span>
                {c.text}
              </span>
              {status === "wrong" && isSel && <span className="font-extrabold text-destructive">✕</span>}
              {status !== "idle" && isAns && <span className="font-extrabold text-success">✓</span>}
            </button>
          )
        })}
      </div>

      {/* wrong: keyNote + slot AI */}
      {status === "wrong" && (
        <>
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-bg p-4">
            <div className="mb-1.5 text-xs font-bold text-destructive">💡 Ghi nhớ</div>
            <div className="text-[13px] leading-relaxed text-destructive/90">{keyNote}</div>
          </div>
          {/* slot cho AI explanation — thay bằng nội dung stream của bạn */}
          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/[.06] p-4">
            <span className="size-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            <div className="text-xs text-primary/90">AI đang soạn giải thích chi tiết…</div>
          </div>
        </>
      )}

      {/* correct banner */}
      {status === "correct" && (
        <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-success/30 bg-success-bg p-4.5 animate-[pop_320ms_ease]">
          <div className="grid size-11 place-items-center rounded-full bg-success text-xl font-extrabold text-success-foreground">✓</div>
          <div>
            <div className="text-base font-extrabold text-success">Chính xác!</div>
            <div className="text-[13px] text-success/90">+10 XP · giữ vững phong độ 🔥</div>
          </div>
        </div>
      )}

      {/* footer actions */}
      <div className="mt-5 flex gap-2.5">
        {status === "idle" && (
          <Button className="w-full" disabled={!selected} onClick={check}>Kiểm tra</Button>
        )}
        {status === "wrong" && (
          <>
            <Button variant="outline" className="flex-1" onClick={reset}>↺ Thử lại</Button>
            <Button className="flex-1">Câu tiếp →</Button>
          </>
        )}
        {status === "correct" && (
          <Button variant="success" className="w-full">Câu tiếp theo →</Button>
        )}
      </div>
    </div>
  )
}
