import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_lib import classify, scan_repo, TOEIC_FILES

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

if __name__ == "__main__":
    unittest.main()
