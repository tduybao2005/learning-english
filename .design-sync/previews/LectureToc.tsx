import { LectureToc } from "web";

export const Default = () => (
  <div className="w-72">
    <LectureToc
      entries={[
        { id: "gioi-thieu", text: "Giới thiệu" },
        { id: "cau-truc", text: "Cấu trúc câu" },
        { id: "vi-du", text: "Ví dụ thực tế" },
        { id: "loi-thuong-gap", text: "Lỗi thường gặp" },
        { id: "bai-tap", text: "Bài tập vận dụng" },
      ]}
    />
  </div>
);

export const Short = () => (
  <div className="w-72">
    <LectureToc
      entries={[
        { id: "ly-thuyet", text: "Lý thuyết" },
        { id: "thuc-hanh", text: "Thực hành" },
      ]}
    />
  </div>
);
