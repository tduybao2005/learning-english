import { IeltsHub } from "web";

const tests = Array.from({ length: 30 }, (_, i) => ({
  number: i + 1,
  isComplete: i < 26,
}));

export const Default = () => (
  <div className="w-[52rem]">
    <IeltsHub tests={tests} linkComponent="a" />
  </div>
);

// Deep-linked from a skill tab: `initialSkill` selects the segmented control.
export const WritingSkill = () => (
  <div className="w-[52rem]">
    <IeltsHub tests={tests} initialSkill="writing" linkComponent="a" />
  </div>
);

// Under 16 tests: no "xem tất cả" footer row.
export const FewTests = () => (
  <div className="w-[52rem]">
    <IeltsHub tests={tests.slice(0, 8)} linkComponent="a" />
  </div>
);
