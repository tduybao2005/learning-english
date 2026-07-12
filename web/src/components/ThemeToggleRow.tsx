import { Switch } from "@/components/ui/switch";

/** Settings row toggling dark mode — presentational: a labelled row with a
 * controlled `Switch`.
 *
 * The theme hook (and the mount guard that keeps the server render from
 * disagreeing about the stored theme) lives in `ThemeToggleRowConnected`. */
export function ThemeToggleRow({
  checked,
  onCheckedChange,
}: {
  /** `true` when dark mode is on. */
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-secondary text-base">
          🌙
        </span>
        <p className="text-sm font-semibold">Giao diện tối</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Bật giao diện tối"
      />
    </div>
  );
}
