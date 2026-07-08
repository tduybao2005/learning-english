// web/src/components/vocab/match.tsx
// Ghép cặp 2 cột (từ ↔ nghĩa) tap-to-pair + đồng hồ đếm.
// Chọn 1 ô trái rồi 1 ô phải: đúng → xanh success, sai → shake ngắn.
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

type Pair = { en: string; vi: string }

export function VocabMatch({
  pairs = [
    { en: "abundant", vi: "dồi dào" },
    { en: "scarce", vi: "khan hiếm" },
    { en: "fragile", vi: "dễ vỡ" },
  ],
}: { pairs?: Pair[] }) {
  const left = pairs.map((p) => p.en)
  const right = React.useMemo(() => [...pairs.map((p) => p.vi)].sort(() => Math.random() - 0.5), [pairs])

  const [sec, setSec] = React.useState(48)
  const [selL, setSelL] = React.useState<string | null>("abundant")
  const [matched, setMatched] = React.useState<Set<string>>(new Set())
  const [wrong, setWrong] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  function pickRight(vi: string) {
    if (!selL) return
    const correct = pairs.find((p) => p.en === selL)?.vi === vi
    if (correct) {
      setMatched((m) => new Set(m).add(selL))
      setSelL(null)
    } else {
      setWrong(vi); setTimeout(() => setWrong(null), 360)
    }
  }

  const mm = String(Math.floor(sec / 60))
  const ss = String(sec % 60).padStart(2, "0")

  return (
    <div className="mx-auto flex min-h-[520px] max-w-md flex-col px-5 py-4">
      <div className="mb-5.5 flex items-center justify-between">
        <button className="grid size-8 place-items-center rounded-md bg-muted text-sm">✕</button>
        <div className="flex items-center gap-1.5 rounded-full bg-primary/[.10] px-3.5 py-1.5">
          <span>⏱</span>
          <span className="text-[15px] font-extrabold tabular-nums text-primary">{mm}:{ss}</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{matched.size}/{pairs.length}</span>
      </div>

      <div className="mb-3.5 text-center text-sm font-bold">Nối từ với nghĩa</div>

      <div className="mb-auto grid grid-cols-2 gap-3">
        {/* left */}
        <div className="flex flex-col gap-3">
          {left.map((en) => {
            const done = matched.has(en)
            const active = selL === en
            return (
              <button key={en} disabled={done} onClick={() => !done && setSelL(en)}
                className={cn("rounded-xl px-3 py-4 text-center text-sm font-semibold transition-all",
                  done ? "border border-success/40 bg-success-bg text-success"
                    : active ? "bg-primary text-primary-foreground shadow-[0_4px_12px_--theme(--color-primary/30%)]"
                    : "border border-border bg-card")}>
                {en}
              </button>
            )
          })}
        </div>
        {/* right */}
        <div className="flex flex-col gap-3">
          {right.map((vi) => {
            const done = pairs.some((p) => matched.has(p.en) && p.vi === vi)
            const isWrong = wrong === vi
            return (
              <button key={vi} disabled={done} onClick={() => pickRight(vi)}
                className={cn("rounded-xl px-3 py-4 text-center text-sm font-semibold transition-all",
                  done ? "border border-success/40 bg-success-bg text-success"
                    : isWrong ? "border-2 border-destructive bg-destructive-bg text-destructive animate-[shake_360ms_ease]"
                    : "border border-border bg-card")}>
                {vi}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4.5 text-center text-xs text-muted-foreground">
        Đã ghép <strong className="text-success">{matched.size}</strong> / {pairs.length}
      </div>
    </div>
  )
}
