import { GoalPicker } from "web";

const noop = () => {};

export const IeltsSelected = () => (
  <div className="w-[34rem]">
    <GoalPicker value={{ goalType: "IELTS", goalValue: "6.5" }} onChange={noop} />
  </div>
);

export const CefrSelected = () => (
  <div className="w-[34rem]">
    <GoalPicker value={{ goalType: "CEFR", goalValue: "B2" }} onChange={noop} />
  </div>
);

export const Unset = () => (
  <div className="w-[34rem]">
    <GoalPicker value={null} onChange={noop} />
  </div>
);
