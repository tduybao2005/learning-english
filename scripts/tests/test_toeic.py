import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_lib import classify, scan_repo, TOEIC_FILES
from check_toeic import check_test, find_duplicate_passages

class TestToeicClassify(unittest.TestCase):
    def test_toeic_files(self):
        self.assertEqual(TOEIC_FILES,
            ("listening.md", "reading.md", "speaking.md", "writing.md", "answer_key.md"))

    def test_classify_reading(self):
        meta = classify(Path("toeic_practice_tests/test_07/reading.md"))
        self.assertEqual(meta["type"], "toeic_reading")
        self.assertEqual(meta["test"], 7)
        self.assertEqual(meta["cefr"], "B1-C1")
        self.assertEqual(meta["id"], "toeic_practice_tests/test_07/reading")

    def test_classify_score_report(self):
        meta = classify(Path("toeic_practice_tests/test_07/score_report_2026-07-09.md"))
        self.assertEqual(meta["type"], "score_report")

class TestScanRepo(unittest.TestCase):
    def test_scan_includes_toeic(self, ):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            d = root / "toeic_practice_tests" / "test_01"
            d.mkdir(parents=True)
            for f in TOEIC_FILES[:2]:
                (d / f).write_text("# x", encoding="utf-8")
            data = scan_repo(root)
            self.assertEqual(len(data["toeic_tests"]), 1)
            self.assertFalse(data["toeic_tests"][0]["complete"])


def _reading_md(passage_line="Standard business passage filler text used for testing only here."):
    lines = ["# TOEIC Reading — Test 01", "", "## PART 5: INCOMPLETE SENTENCES (Q101-130)", ""]
    for n in range(101, 131):
        lines.append(f"**{n}.** Filler sentence ______.")
        lines.append("(A) a (B) b (C) c (D) d")
    lines += ["", "## PART 6: TEXT COMPLETION (Q131-146)", ""]
    for n in range(131, 147):
        lines.append(f"**{n}.** Filler sentence ______.")
        lines.append("(A) a (B) b (C) c (D) d")
    lines += ["", "## PART 7: READING COMPREHENSION (Q147-200)", "", passage_line, ""]
    for n in range(147, 201):
        lines.append(f"**{n}.** Filler question?")
        lines.append("(A) a (B) b (C) c (D) d")
    return "\n".join(lines) + "\n"


def _answer_key_md():
    lines = ["# TOEIC Answer Key — Test 01", "", "## PHẦN 2: READING — ĐÁP ÁN (Q101-200)", ""]
    letters = ["A", "B", "C", "D"]
    for n in range(101, 201):
        lines.append(f"{n}. {letters[n % 4]}")
    lines += ["", "## PHẦN 3: BẢNG QUY ĐỔI ĐIỂM", "", "| Raw | Listening | Reading |",
              "|---|---|---|"]
    for raw in range(100, -5, -5):
        lines.append(f"| {raw} | {raw*4}-{raw*4+15} | {raw*4}-{raw*4+15} |")
    return "\n".join(lines) + "\n"


def _speaking_md():
    lines = ["# TOEIC Speaking — Test 01", ""]
    for n in range(1, 12):
        lines.append(f"### Q{n}")
        lines.append("Prompt text.")
        lines.append("#### Gợi ý (Model answer)")
        lines.append("Model answer text.")
        lines.append("")
    return "\n".join(lines) + "\n"


def _writing_md():
    lines = ["# TOEIC Writing — Test 01", ""]
    for n in range(1, 9):
        lines.append(f"### Q{n}")
        lines.append("Prompt text.")
        lines.append("#### Gợi ý (Model answer)")
        lines.append("Model answer text.")
        lines.append("")
    return "\n".join(lines) + "\n"


def _listening_md():
    return "\n".join([
        "# TOEIC Listening — Test 01", "",
        "## PART 1: PHOTOGRAPHS (Questions 1-6)", "",
        "## PART 2: QUESTION-RESPONSE (Questions 7-31)", "",
        "## PART 3: CONVERSATIONS (Questions 32-70)", "",
        "## PART 4: SHORT TALKS (Questions 71-100)", "",
    ]) + "\n"


def _write_valid_test(d: Path, passage_line=None):
    d.mkdir(parents=True, exist_ok=True)
    (d / "reading.md").write_text(
        _reading_md(passage_line) if passage_line else _reading_md(), encoding="utf-8")
    (d / "answer_key.md").write_text(_answer_key_md(), encoding="utf-8")
    (d / "speaking.md").write_text(_speaking_md(), encoding="utf-8")
    (d / "writing.md").write_text(_writing_md(), encoding="utf-8")
    (d / "listening.md").write_text(_listening_md(), encoding="utf-8")


class TestCheckToeic(unittest.TestCase):
    def test_valid_test_has_no_errors(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            d = root / "toeic_practice_tests" / "test_01"
            _write_valid_test(d)
            errors = check_test(d)
            self.assertEqual(errors, [])

    def test_missing_reading_question_is_reported(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            d = root / "toeic_practice_tests" / "test_02"
            _write_valid_test(d)
            text = (d / "reading.md").read_text(encoding="utf-8")
            # Remove question 150 to create a gap.
            text = text.replace("**150.** Filler question?\n(A) a (B) b (C) c (D) d\n", "")
            (d / "reading.md").write_text(text, encoding="utf-8")
            errors = check_test(d)
            self.assertTrue(any("150" in e for e in errors), errors)

    def test_invalid_answer_letter_is_reported(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            d = root / "toeic_practice_tests" / "test_03"
            _write_valid_test(d)
            text = (d / "answer_key.md").read_text(encoding="utf-8")
            text = text.replace("101. A", "101. E").replace("101. B", "101. E") \
                       .replace("101. C", "101. E").replace("101. D", "101. E")
            (d / "answer_key.md").write_text(text, encoding="utf-8")
            errors = check_test(d)
            self.assertTrue(any("101" in e for e in errors), errors)

    def test_duplicate_passage_warning_across_tests(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            shared = ("This exact passage line is shared verbatim between two entirely "
                      "different tests here, which should never happen in real content.")
            d1 = root / "toeic_practice_tests" / "test_01"
            d2 = root / "toeic_practice_tests" / "test_02"
            _write_valid_test(d1, passage_line=shared)
            _write_valid_test(d2, passage_line=shared)
            warnings = find_duplicate_passages([d1, d2])
            self.assertTrue(len(warnings) >= 1)


if __name__ == "__main__":
    unittest.main()
