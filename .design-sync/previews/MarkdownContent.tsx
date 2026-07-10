import { MarkdownContent } from "web";

const LECTURE = `
## Thì hiện tại hoàn thành

Dùng để nói về hành động **bắt đầu trong quá khứ** và còn liên quan tới hiện tại.

- I *have lived* in Hanoi since 2019.
- She *has finished* her homework.

| Dạng | Cấu trúc |
| ---- | -------- |
| Khẳng định | S + have/has + V3 |
| Phủ định | S + haven't/hasn't + V3 |

> Lưu ý: dùng \`since\` với mốc thời gian, \`for\` với khoảng thời gian.
`;

export const Lecture = () => (
  <div className="w-[34rem]">
    <MarkdownContent content={LECTURE} />
  </div>
);

export const WithFrontMatter = () => (
  <div className="w-[34rem]">
    <MarkdownContent
      content={`---\ntitle: Bài 12\ncefr: B1\n---\n\nFront-matter phía trên được lược bỏ tự động.\n\n**Nội dung** bắt đầu từ đây.`}
    />
  </div>
);
