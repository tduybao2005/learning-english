// web/src/components/vocab/flashcard.tsx
// Thẻ lật 3D (front: từ + phiên âm / back: nghĩa). Bấm để lật.
"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"

export function Flashcard({
  word = "resilient", ipa = "/rɪˈzɪliənt/ · adj",
  meaning = "kiên cường", note = "Có khả năng phục hồi nhanh sau khó khăn.",
  example = "a resilient learner",
  index = 9, total = 24,
  onKnow, onDontKnow,
}: {
  word?: string; ipa?: string; meaning?: string; note?: string; example?: string
  index?: number; total?: number; onKnow?: () => void; onDontKnow?: () => void
}) {
  const [flipped, setFlipped] = React.useState(false)

  return (
    <div className="mx-auto flex min-h-[520px] max-w-md flex-col px-5 py-4">
      <div className="mb-6 flex items-center gap-3">
        <button className="grid size-8 place-items-center rounded-md bg-muted text-sm">✕</button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="text-xs font-bold text-muted-foreground">{index}/{total}</span>
      </div>

      {/* card */}
      <div className="mb-5 flex-1 [perspective:1000px]" onClick={() => setFlipped((f) => !f)}>
        <div
          className="relative h-full min-h-[280px] w-full cursor-pointer transition-transform duration-[320ms] [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", transitionTimingFunction: "cubic-bezier(.2,.9,.3,1.2)" }}
        >
          {/* front */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgba(40,40,60,.10)] [backface-visibility:hidden]">
            <span className="text-[34px] font-extrabold tracking-tight">{word}</span>
            <span className="text-sm text-muted-foreground">{ipa}</span>
            <span className="mt-5 text-xs text-muted-foreground/70">Nhấn để xem nghĩa ↻</span>
          </div>
          {/* back */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary p-6 text-center text-primary-foreground [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-3xl font-extrabold">{meaning}</span>
            <span className="text-sm opacity-90">{note}</span>
            <span className="mt-2 text-xs italic opacity-80">&ldquo;{example}&rdquo;</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="destructive" className="flex-1" onClick={onDontKnow}>Chưa thuộc</Button>
        <Button variant="success" className="flex-1" onClick={onKnow}>Đã thuộc ✓</Button>
      </div>
    </div>
  )
}
