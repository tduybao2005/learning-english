"""Tests for the curriculum tooling. Run from repo root:
python3 -m unittest discover -s scripts/tests -v
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import curriculum_lib as lib  # noqa: E402


def make_fixture(root: Path) -> None:
    """Miniature curriculum: 1 complete lesson, 1 exam, 1 incomplete IELTS test."""
    les = root / "phase_1_foundation" / "lesson_01_simple_present"
    les.mkdir(parents=True)
    (les / "lecture.md").write_text(
        "# BÀI 1: THÌ HIỆN TẠI ĐƠN (SIMPLE PRESENT TENSE)\n\nnội dung\n",
        encoding="utf-8")
    (les / "vocabulary.md").write_text("# VOCABULARY - BÀI 1\n\n| Word |\n", encoding="utf-8")
    (les / "exercise.md").write_text(
        "# EXERCISE - BÀI 1\n\n## SECTION A\n\n1. ...\n\n## ANSWER KEY (ĐÁP ÁN)\n\n1. cooks\n",
        encoding="utf-8")
    exam = root / "phase_1_foundation" / "exam"
    exam.mkdir()
    (exam / "phase1_exam.md").write_text("# KIỂM TRA CUỐI GIAI ĐOẠN 1\n", encoding="utf-8")
    (exam / "phase1_answer_key.md").write_text("# ĐÁP ÁN PHASE 1\n", encoding="utf-8")
    test = root / "ielts_practice_tests" / "test_01"
    test.mkdir(parents=True)
    for name in ("reading.md", "writing.md", "speaking.md"):
        (test / name).write_text(f"# IELTS {name}\n", encoding="utf-8")
    # answer_key.md deliberately missing -> incomplete test


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        make_fixture(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_classify_lesson_and_ielts_files(self):
        meta = lib.classify(Path("phase_1_foundation/lesson_01_simple_present/lecture.md"))
        self.assertEqual(meta["type"], "lecture")
        self.assertEqual(meta["phase"], 1)
        self.assertEqual(meta["topic"], "simple present")
        self.assertEqual(meta["cefr"], "A1-A2")
        meta = lib.classify(Path("phase_1_foundation/exam/phase1_answer_key.md"))
        self.assertEqual(meta["type"], "phase_exam_answer_key")
        meta = lib.classify(Path("ielts_practice_tests/test_01/reading.md"))
        self.assertEqual(meta["type"], "ielts_reading")
        self.assertEqual(meta["test"], 1)
        self.assertIsNone(lib.classify(Path("docs/STATUS.md")))
        self.assertIsNone(lib.classify(Path("README.md")))

    def test_scan_finds_lesson_and_flags_incomplete_test(self):
        data = lib.scan_repo(self.tmp)
        self.assertEqual(len(data["phases"]), 1)
        phase = data["phases"][0]
        self.assertEqual(phase["number"], 1)
        self.assertEqual(phase["cefr"], "A1-A2")
        lesson = phase["lessons"][0]
        self.assertTrue(lesson["complete"])
        self.assertEqual(lesson["topic"], "simple present")
        self.assertEqual(lesson["title"], "BÀI 1: THÌ HIỆN TẠI ĐƠN (SIMPLE PRESENT TENSE)")
        self.assertTrue(phase["exam"]["exam"])
        self.assertTrue(phase["exam"]["answer_key"])
        self.assertEqual(len(data["ielts_tests"]), 1)
        self.assertFalse(data["ielts_tests"][0]["complete"])
        self.assertFalse(data["ielts_tests"][0]["files"]["answer_key.md"])


if __name__ == "__main__":
    unittest.main()
