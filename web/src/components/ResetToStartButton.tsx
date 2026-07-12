import { Button } from "@/components/ui/button";

/**
 * "Tôi muốn bắt đầu từ đầu" — presentational. Offers to override the
 * placement-assigned start point and unlock the very first lesson of the
 * whole curriculum instead.
 *
 * The `POST /api/placement/reset-to-start` call and the router navigation
 * live in `ResetToStartButtonConnected`.
 */
export function ResetToStartButton({
  onReset,
  pending = false,
  error = null,
}: {
  /** Invoked on click. The wrapper posts to the reset route, then navigates. */
  onReset: () => void;
  pending?: boolean;
  /** Failure message shown under the button; `null` when there is none. */
  error?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={pending}>
        {pending ? "Đang xử lý..." : "Tôi muốn bắt đầu từ đầu"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
