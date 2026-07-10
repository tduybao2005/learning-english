import { ListeningSetCard } from "web";

// `linkComponent="a"` is the design-time link — same markup, no Next navigation.
export const WithDuration = () => (
  <div className="w-[28rem]">
    <ListeningSetCard
      href="/listening/practice_a2_01"
      title="Sports and Leisure"
      questionCount={40}
      durationLabel="8:20"
      linkComponent="a"
    />
  </div>
);

export const WithoutDuration = () => (
  <div className="w-[28rem]">
    <ListeningSetCard
      href="/listening/practice_a2_02"
      title="At the Library"
      questionCount={40}
      linkComponent="a"
    />
  </div>
);

export const LongTitle = () => (
  <div className="w-[28rem]">
    <ListeningSetCard
      href="/listening/practice_b1_03"
      title="Cuộc phỏng vấn xin việc tại một công ty công nghệ ở thành phố"
      questionCount={30}
      durationLabel="12:45"
      linkComponent="a"
    />
  </div>
);
