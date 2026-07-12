"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SettingsNameEditor } from "@/components/SettingsNameEditor";

/** Router-aware wrapper around the presentational `SettingsNameEditor`.
 *
 * Posts the new display name to `POST /api/profile/name`, then
 * `router.refresh()`es so the server-rendered banner picks it up. */
export function SettingsNameEditorConnected({
  initialName,
  email,
}: {
  initialName: string | null;
  email: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave(name: string) {
    setPhase("saving");
    try {
      const res = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setPhase("saved");
      router.refresh();
    } catch {
      setPhase("error");
    }
  }

  return (
    <SettingsNameEditor
      name={initialName}
      email={email}
      onSave={handleSave}
      pending={phase === "saving"}
      saved={phase === "saved"}
      error={phase === "error"}
    />
  );
}
