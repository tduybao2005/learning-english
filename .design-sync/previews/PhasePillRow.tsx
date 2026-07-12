import { PhasePillRow } from "web";

const lessons = [
  { id: "l1", orderIndex: 1, title: "Chào hỏi", state: "COMPLETED" as const, href: "/learn/p1/l1" },
  { id: "l2", orderIndex: 2, title: "Gia đình", state: "COMPLETED" as const, href: "/learn/p1/l2" },
  { id: "l3", orderIndex: 3, title: "Số đếm", state: "SKIPPED" as const, href: "/learn/p1/l3" },
  { id: "l4", orderIndex: 4, title: "Thì hiện tại đơn", state: "UNLOCKED" as const, href: "/learn/p1/l4" },
  { id: "l5", orderIndex: 5, title: "Danh từ đếm được", state: "LOCKED" as const, href: "/learn/p1/l5" },
  { id: "l6", orderIndex: 6, title: "Giới từ chỉ nơi chốn", state: "LOCKED" as const, href: "/learn/p1/l6" },
  { id: "l7", orderIndex: 7, title: "Câu hỏi Wh-", state: "LOCKED" as const, href: "/learn/p1/l7" },
];

// Collapsed: a horizontally scrolling row auto-centered on the UNLOCKED pill.
export const Default = () => (
  <div className="w-[36rem]">
    <PhasePillRow lessons={lessons} total={lessons.length} linkComponent="a" />
  </div>
);

// A phase whose lessons are all done — every pill is the success variant.
export const AllCompleted = () => (
  <div className="w-[36rem]">
    <PhasePillRow
      lessons={lessons.map((l) => ({ ...l, state: "COMPLETED" as const }))}
      total={lessons.length}
      linkComponent="a"
    />
  </div>
);
