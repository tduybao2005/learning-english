import { SettingsGoalForm } from "web";

export const Default = () => (
  <div className="w-[40rem]">
    <SettingsGoalForm
      value={{ goalType: "IELTS", goalValue: "6.5" }}
      onChange={() => {}}
      onSubmit={() => {}}
    />
  </div>
);

export const Saved = () => (
  <div className="w-[40rem]">
    <SettingsGoalForm
      value={{ goalType: "CEFR", goalValue: "B2" }}
      onChange={() => {}}
      onSubmit={() => {}}
      status="saved"
    />
  </div>
);

export const SaveError = () => (
  <div className="w-[40rem]">
    <SettingsGoalForm
      value={{ goalType: "IELTS", goalValue: "7.0" }}
      onChange={() => {}}
      onSubmit={() => {}}
      status="error"
    />
  </div>
);
