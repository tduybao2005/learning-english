import { describe, expect, it } from "vitest";

import { extractToc, slugifyHeading } from "./toc";

describe("slugifyHeading", () => {
  it("lowercases, hyphenates, strips Vietnamese diacriticals incl. đ", () => {
    expect(slugifyHeading("Cấu trúc")).toBe("cau-truc");
    expect(slugifyHeading("Dấu hiệu nhận biết")).toBe("dau-hieu-nhan-biet");
    expect(slugifyHeading("So sánh với quá khứ đơn")).toBe("so-sanh-voi-qua-khu-don");
  });

  it("drops punctuation and collapses whitespace", () => {
    expect(slugifyHeading("Have/Has + V3 (past participle)!")).toBe("havehas-v3-past-participle");
  });
});

describe("extractToc", () => {
  it("collects H2s only, in order", () => {
    const md = "# Title\n\n## Cấu trúc\ntext\n### sub\n\n## Cách dùng\n";
    expect(extractToc(md)).toEqual([
      { id: "cau-truc", text: "Cấu trúc" },
      { id: "cach-dung", text: "Cách dùng" },
    ]);
  });

  it("ignores ## lines inside fenced code blocks and strips inline markers", () => {
    const md = "```\n## not a heading\n```\n## **Dấu hiệu** `nhận biết`\n";
    expect(extractToc(md)).toEqual([{ id: "dau-hieu-nhan-biet", text: "Dấu hiệu nhận biết" }]);
  });

  it("returns [] when there are no H2s", () => {
    expect(extractToc("# only h1\nbody")).toEqual([]);
  });
});
