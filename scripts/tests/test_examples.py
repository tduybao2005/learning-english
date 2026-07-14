import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_examples import check_lecture, parse_examples

GOOD = """# BÀI 1

## GIỚI THIỆU

Không cần ví dụ ở đây.

## PHẦN 1: CẤU TRÚC

She works here every single day.

```example
id: l01-p1-1
prompt: My brother ___ (work) in a hospital.
hint: Ngôi thứ ba số ít.
answer: works
```

```example
id: l01-p1-2
prompt: The shop ___ (close) at 10 pm.
hint: Chủ ngữ số ít.
answer: closes
```

## TÓM TẮT NHANH

Không cần ví dụ.
"""


class ParseTests(unittest.TestCase):
    def test_parses_well_formed_blocks(self):
        examples, errors = parse_examples(GOOD)
        self.assertEqual([e["id"] for e in examples], ["l01-p1-1", "l01-p1-2"])
        self.assertEqual(errors, [])

    def test_reports_missing_key(self):
        text = "```example\nid: x\nprompt: A ___ b.\nhint: h\n```\n"
        _, errors = parse_examples(text)
        self.assertTrue(any("answer" in e for e in errors))

    def test_reports_unknown_key(self):
        text = "```example\nid: x\nprompt: A ___ b.\nhint: h\nanswer: c\nnote: d\n```\n"
        _, errors = parse_examples(text)
        self.assertTrue(any("note" in e for e in errors))

    def test_reports_missing_blank(self):
        text = "```example\nid: x\nprompt: No blank here.\nhint: h\nanswer: c\n```\n"
        _, errors = parse_examples(text)
        self.assertTrue(any("___" in e for e in errors))

    def test_reports_duplicate_id(self):
        _, errors = parse_examples(GOOD + GOOD)
        self.assertTrue(any("duplicate" in e for e in errors))


class CoverageTests(unittest.TestCase):
    def test_good_lecture_passes(self):
        self.assertEqual(check_lecture(GOOD), [])

    def test_section_with_too_few_examples_fails(self):
        text = GOOD.replace(
            "```example\nid: l01-p1-2\nprompt: The shop ___ (close) at 10 pm.\n"
            "hint: Chủ ngữ số ít.\nanswer: closes\n```\n\n",
            "",
        )
        errors = check_lecture(text)
        self.assertTrue(any("PHẦN 1" in e for e in errors))

    def test_example_reusing_a_lecture_sentence_fails(self):
        text = GOOD.replace(
            "prompt: My brother ___ (work) in a hospital.",
            "prompt: She ___ here every single day.",
        )
        errors = check_lecture(text)
        self.assertTrue(any("trùng câu" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
