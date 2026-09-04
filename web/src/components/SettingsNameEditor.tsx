"use client";

import { useEffect, useState } from "react";

/**
 * Inline display-name editor inside the settings banner (design item 7) —
 * presentational: view mode shows the name + a ✏️ button; edit mode swaps to
 * an input with a live character counter, Lưu/Huỷ, "✓ Đã lưu" on success, and
 * an error when the name is empty. Styled for the primary (dark) banner
 * background.
 *
 * View/edit mode and the draft text are local UI state and stay here. The
 * `POST /api/profile/name` call and `router.refresh()` live in
 * `SettingsNameEditorConnected`; this component only reports the new name via
 * `onSave` and reflects `pending` / `saved` / `error` back to the user.
 *
 * Marked `"use client"` because it holds state — it imports no router, auth
 * or theme hook, so it still bundles into the design system.
 */
export function SettingsNameEditor({
  name,
  email,
  onSave,
  pending = false,
  saved = false,
  error = false,
  defaultEditing = false,
}: {
  /** The persisted display name; `null` falls back to the email. */
  name: string | null;
  email: string;
  /** Invoked with the trimmed, non-empty name. The wrapper does the POST. */
  onSave: (name: string) => void;
  pending?: boolean;
  /** Last save succeeded — shows "✓ Đã lưu" and closes edit mode. */
  saved?: boolean;
  /** Last save failed — shows the error line. */
  error?: boolean;
  /** Start in edit mode (design-system previews). */
  defaultEditing?: boolean;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState(name ?? "");
  const [blank, setBlank] = useState(false);

  // A successful save closes the editor. `saved` is owned by the wrapper, so
  // this mirrors it into the local view/edit state.
  useEffect(() => {
    if (saved) setEditing(false);
  }, [saved]);

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setBlank(true);
      return;
    }
    setBlank(false);
    onSave(trimmed);
  }

  if (!editing) {
    return (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {name ?? email}
          <button
            type="button"
            aria-label="Sửa tên hiển thị"
            onClick={() => {
              setDraft(name ?? "");
              setBlank(false);
              setEditing(true);
            }}
            className="press-btn rounded p-0.5 opacity-80 transition-all hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            ✏️
          </button>
          {saved && <span className="text-xs font-normal">✓ Đã lưu</span>}
        </p>
        {name ? <p className="truncate text-xs text-primary-foreground/80">{email}</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          maxLength={50}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full max-w-56 rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/50 focus-visible:ring-2 focus-visible:ring-white/50"
        />
        <button type="button" onClick={submit} disabled={pending} className="press-btn rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold transition-all hover:bg-white/30">
          {pending ? "..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-primary-foreground/80 hover:text-primary-foreground">
          Huỷ
        </button>
      </div>
      <p className="mt-1 text-xs text-primary-foreground/70">
        {blank
          ? "Tên không được để trống."
          : error
            ? "Không thể lưu tên. Vui lòng thử lại."
            : `${draft.trim().length}/50 ký tự`}
      </p>
    </div>
  );
}
