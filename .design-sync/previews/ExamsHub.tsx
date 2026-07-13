import { ExamsHub } from "web";

// `linkComponent="a"` is the design-time link — same markup, no Next navigation.
// TOEIC has `href: null`: the muted, non-interactive "sắp có" state.

export const WithProgress = () => (
  <div className="w-full max-w-3xl">
    <ExamsHub
      linkComponent="a"
      examTypes={[
        {
          key: "ielts",
          name: "IELTS",
          subtitle: "30 đề · 30 đề đủ nội dung",
          description: "Reading, Writing và Speaking, chấm theo thang band 0–9.",
          href: "/ielts",
          stat: "Band 6.5",
          icon: "graduation",
        },
        {
          key: "toeic",
          name: "TOEIC",
          subtitle: "3 đề · sắp có",
          description: "Listening & Reading theo thang 5–495 mỗi kỹ năng.",
          href: null,
          stat: "Sắp có",
          icon: "file",
        },
      ]}
    />
  </div>
);

export const NoAttempts = () => (
  <div className="w-full max-w-3xl">
    <ExamsHub
      linkComponent="a"
      examTypes={[
        {
          key: "ielts",
          name: "IELTS",
          subtitle: "30 đề · 30 đề đủ nội dung",
          description: "Reading, Writing và Speaking, chấm theo thang band 0–9.",
          href: "/ielts",
          stat: null,
          icon: "graduation",
        },
        {
          key: "toeic",
          name: "TOEIC",
          subtitle: "3 đề · sắp có",
          description: "Listening & Reading theo thang 5–495 mỗi kỹ năng.",
          href: null,
          stat: "Sắp có",
          icon: "file",
        },
      ]}
    />
  </div>
);
