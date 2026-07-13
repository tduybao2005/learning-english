import { expect, test } from "vitest";

import { slugifyWord, vocabAudioPath } from "@/lib/audio/vocab-audio";

test("hạ chữ thường và thay khoảng trắng bằng gạch ngang", () => {
  expect(slugifyWord("Take off")).toBe("take-off");
});

test("bỏ ký tự không phải chữ/số", () => {
  expect(slugifyWord("mother-in-law's")).toBe("mother-in-law-s");
});

test("gộp gạch ngang thừa và cắt hai đầu", () => {
  expect(slugifyWord("  to  be   (v.) ")).toBe("to-be-v");
});

test("vocabAudioPath trỏ vào public/audio/vocab", () => {
  expect(vocabAudioPath("Take off")).toBe("/audio/vocab/take-off.mp3");
});
