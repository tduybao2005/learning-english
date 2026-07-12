import { LessonNode } from "web";

export const Completed = () => (
  <LessonNode state="COMPLETED" label="Bài 1" href="/learn/phase-1/lesson-01" title="Chào hỏi" linkComponent="a" />
);

export const Unlocked = () => (
  <LessonNode state="UNLOCKED" label="Bài 2" href="/learn/phase-1/lesson-02" title="Gia đình" linkComponent="a" />
);

export const Skipped = () => (
  <LessonNode state="SKIPPED" label="Bài 3" href="/learn/phase-1/lesson-03" title="Số đếm" linkComponent="a" />
);

// LOCKED renders a non-interactive <span> — no href is used even if passed.
export const Locked = () => <LessonNode state="LOCKED" label="Bài 4" title="Thì quá khứ" linkComponent="a" />;
