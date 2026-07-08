"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline display-name editor inside the settings banner (design item 7):
 * view mode shows the name + a ✏️ button; edit mode swaps to an input with
 * a live character counter, Lưu/Huỷ, "✓ Đã lưu" on success, and an error
 * when the name is empty. Styled for the primary (dark) banner background.
 */
export function SettingsNameEditor({
  initialName,
  email,
}: {
  initialName: string | null;
  email: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setPhase("error");
      return;
    }
    setPhase("saving");
    try {
      const res = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      setPhase("saved");
      setEditing(false);
      router.refresh();
    } catch {
      setPhase("error");
    }
  }

  if (!editing) {
    return (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {initialName ?? email}
          <button
            type="button"
            aria-label="Sửa tên hiển thị"
            onClick={() => {
              setName(initialName ?? "");
              setPhase("idle");
              setEditing(true);
            }}
            className="rounded p-0.5 opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            ✏️
          </button>
          {phase === "saved" && <span className="text-xs font-normal">✓ Đã lưu</span>}
        </p>
        {initialName ? <p className="truncate text-xs text-primary-foreground/80">{email}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={50}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full max-w-56 rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/50 focus-visible:ring-2 focus-visible:ring-white/50"
        />
        <button type="button" onClick={save} disabled={phase === "saving"} className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30">
          {phase === "saving" ? "..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-primary-foreground/80 hover:text-primary-foreground">
          Huỷ
        </button>
      </div>
      <p className="mt-1 text-xs text-primary-foreground/70">
        {phase === "error" ? "Tên không được để trống." : `${name.trim().length}/50 ký tự`}
      </p>
    </div>
  );
}
