"use client";

import { useEffect, type RefObject } from "react";

export function moveIndex(current: number, dir: 1 | -1, length: number): number {
  if (current === -1) return 0;
  return Math.min(Math.max(current + dir, 0), length - 1);
}

/**
 * Global runner shortcuts. Ctrl+Enter always fires the primary action (the
 * reducer/submit guards make it a no-op in invalid phases). Digit keys only
 * act when the user is NOT typing in a text field.
 */
export function useRunnerShortcuts({
  containerRef,
  onPrimaryAction,
}: {
  containerRef: RefObject<HTMLElement | null>;
  onPrimaryAction: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        onPrimaryAction();
        return;
      }

      const root = containerRef.current;
      if (!root) return;

      if (e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const fields = Array.from(root.querySelectorAll<HTMLElement>("[data-answer-field]"));
        if (fields.length === 0) return;
        e.preventDefault();
        const current = fields.indexOf(document.activeElement as HTMLElement);
        fields[moveIndex(current, e.key === "ArrowRight" ? 1 : -1, fields.length)]?.focus();
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-4]$/.test(e.key)) {
        const options = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-mcq-option]"));
        options[Number(e.key) - 1]?.click();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [containerRef, onPrimaryAction]);
}
