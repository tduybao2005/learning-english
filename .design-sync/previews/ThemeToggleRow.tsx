import { ThemeToggleRow } from "web";

export const Off = () => (
  <div className="w-[28rem]">
    <ThemeToggleRow checked={false} onCheckedChange={() => {}} />
  </div>
);

export const On = () => (
  <div className="w-[28rem]">
    <ThemeToggleRow checked onCheckedChange={() => {}} />
  </div>
);
