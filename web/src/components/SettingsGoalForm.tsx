import { Button } from "@/components/ui/button";
import { GoalPicker, type GoalPickerValue } from "@/components/GoalPicker";

/**
 * "Change goal" form for the settings page — presentational. Reuses
 * `GoalPicker` (the same IELTS/CEFR chip UI from onboarding); the selection
 * is a controlled `value`/`onChange` pair and saving is a callback.
 *
 * The `POST /api/onboarding/path` call and `router.refresh()` live in
 * `SettingsGoalFormConnected`.
 */
export function SettingsGoalForm({
  value,
  onChange,
  onSubmit,
  pending = false,
  status = "idle",
}: {
  /** Currently selected goal; `null` when the user has none yet. */
  value: GoalPickerValue | null;
  onChange: (value: GoalPickerValue) => void;
  /** Invoked by "Lưu thay đổi". The wrapper does the POST. */
  onSubmit: () => void;
  pending?: boolean;
  /** Outcome of the last save: drives the confirmation / error line. */
  status?: "idle" | "saved" | "error";
}) {
  return (
    <div>
      <GoalPicker value={value} onChange={onChange} />

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" disabled={pending} onClick={onSubmit}>
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        {status === "saved" ? (
          <p className="text-sm text-success">
            Đã cập nhật mục tiêu học tập.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-destructive">Không thể lưu thay đổi. Vui lòng thử lại.</p>
        ) : null}
      </div>
    </div>
  );
}
