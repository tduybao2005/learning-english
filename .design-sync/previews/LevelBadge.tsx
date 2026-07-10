import { LevelBadge } from "web";

// The variant axis is the CEFR level; each maps to its own semantic-token pill
// via LEVEL_META (A2 success, B1 primary, B2 accent, C1 destructive).
export const Levels = () => (
  <div className="flex flex-wrap items-center gap-3">
    <LevelBadge level="A2" />
    <LevelBadge level="B1" />
    <LevelBadge level="B2" />
    <LevelBadge level="C1" />
  </div>
);
