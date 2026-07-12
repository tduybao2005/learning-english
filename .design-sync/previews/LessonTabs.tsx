import { LessonTabs } from "web";

export const LectureActive = () => (
  <div className="w-[36rem]">
    <LessonTabs
      phaseTitle="Giai đoạn 2 · A2"
      lessonTitle="Thì hiện tại hoàn thành"
      basePath="/learn/phase-2/lesson-05"
      active="lecture"
      linkComponent="a"
    />
  </div>
);

export const ExerciseActive = () => (
  <div className="w-[36rem]">
    <LessonTabs
      phaseTitle="Giai đoạn 2 · A2"
      lessonTitle="Thì hiện tại hoàn thành"
      basePath="/learn/phase-2/lesson-05"
      active="exercise"
      linkComponent="a"
    />
  </div>
);
