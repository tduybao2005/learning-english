// web/src/components/vocab/quiz.tsx
// Quiz 4 đáp án + đếm streak. Đúng → +streak & pop; sai → reset streak & shake.
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

type Q = { word: string; options: string[]; answer: number }

export function VocabQuiz({
  questions = [
    { word: "diligent", options: ["lười biếng", "chăm chỉ", "vui vẻ", "tức giận"], answer: 1 },
    { word: "abundant", options: ["khan hiếm", "dồi dào", "dễ vỡ", "mờ nhạt"], answer: 1 },
  ],
}: { questions?: Q[] }) {
  const [i, setI] = React.useState(0)
  const [streak, setStreak] = React.useState(4)
  const [picked, setPicked] = React.useState<number | null>(null)
  const q = questions[i % questions.length]

  function pick(idx: number) {
    if (picked !== null) return
    setPicked(idx)
    const ok = idx === q.answer
    setStreak((s) => (ok ? s + 1 : 0))
    setTimeout(() => { setPicked(null); setI((n) => n + 1) }, 900)
  }

  return (
    <div className="mx-auto flex min-h-[520px] max-w-md flex-col px-5 py-4">
      {/* header + streak */}
      <div className="mb-6 flex items-center justify-between">
        <button className="grid size-8 place-items-center rounded-md bg-muted text-sm">✕</button>
        <div className="flex items-center gap-1.5 rounded-full bg-streak-bg px-3.5 py-1.5">
          <span className="[animation:var(--animate-flame)] text-base">🔥</span>
          <span className="text-[15px] font-extrabold text-streak-foreground">{streak}</span>
          <span className="text-xs font-semibold text-streak-foreground/80">liên tiếp</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{(i % 12) + 1}/12</span>
      </div>

      <div className="mb-7 text-center">
        <div className="mb-2.5 text-xs font-semibold text-primary">Nghĩa của từ này là?</div>
        <div className="text-[32px] font-extrabold tracking-tight">{q.word}</div>
      </div>

      <div className="mb-auto grid grid-cols-2 gap-3">
        {q.options.map((opt, idx) => {
          const isPicked = picked === idx
          const isAnswer = idx === q.answer
          let tone = "border-border bg-card"
          if (picked !== null && isAnswer) tone = "border-2 border-success bg-success-bg text-success font-bold animate-[pop_320ms_ease]"
          else if (isPicked) tone = "border-2 border-destructive bg-destructive-bg text-destructive font-bold animate-[shake_360ms_ease]"
          return (
            <button key={opt} onClick={() => pick(idx)}
              className={cn("rounded-xl border px-3 py-4.5 text-sm font-semibold transition-all", tone)}>
              {opt}
            </button>
          )
        })}
      </div>

      <div className="mt-4.5 text-center text-xs text-muted-foreground">Trả lời đúng để giữ chuỗi 🔥</div>
    </div>
  )
}
