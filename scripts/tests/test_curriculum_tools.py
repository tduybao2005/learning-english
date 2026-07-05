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


class FrontmatterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        make_fixture(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_script(self, name, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / name), "--root", str(self.tmp), *args],
            capture_output=True, text=True)

    def test_adds_frontmatter_and_is_idempotent(self):
        result = self.run_script("add_frontmatter.py")
        self.assertEqual(result.returncode, 0, result.stderr)
        lecture = self.tmp / "phase_1_foundation/lesson_01_simple_present/lecture.md"
        text = lecture.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"))
        self.assertIn("type: lecture", text)
        self.assertIn("phase: 1", text)
        self.assertIn("cefr: A1-A2", text)
        self.assertIn('topic: "simple present"', text)
        # original first heading is preserved right after the frontmatter block
        self.assertIn("# BÀI 1: THÌ HIỆN TẠI ĐƠN", text)
        reading = (self.tmp / "ielts_practice_tests/test_01/reading.md").read_text(encoding="utf-8")
        self.assertIn("type: ielts_reading", reading)
        self.assertIn("test: 1", reading)
        # second run changes nothing
        before = text
        result2 = self.run_script("add_frontmatter.py")
        self.assertEqual(result2.returncode, 0, result2.stderr)
        self.assertEqual(lecture.read_text(encoding="utf-8"), before)

    def test_dry_run_writes_nothing(self):
        lecture = self.tmp / "phase_1_foundation/lesson_01_simple_present/lecture.md"
        before = lecture.read_text(encoding="utf-8")
        result = self.run_script("add_frontmatter.py", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(lecture.read_text(encoding="utf-8"), before)


class BuildIndexTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        make_fixture(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_script(self, name, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / name), "--root", str(self.tmp), *args],
            capture_output=True, text=True)

    def test_generates_manifest_and_status(self):
        self.run_script("add_frontmatter.py")
        result = self.run_script("build_index.py")
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.tmp / "index/manifest.json").read_text(encoding="utf-8"))
        self.assertIn("generated_at", manifest)
        self.assertEqual(len(manifest["phases"]), 1)
        self.assertFalse(manifest["ielts_tests"][0]["complete"])
        status = (self.tmp / "docs/STATUS.md").read_text(encoding="utf-8")
        self.assertIn("lesson_01_simple_present", status)
        self.assertIn("test_01", status)
        # incomplete IELTS test surfaces as a warning, not an error
        self.assertIn("WARN:", result.stdout)

    def test_check_passes_when_fresh_and_fails_on_drift(self):
        self.run_script("add_frontmatter.py")
        self.run_script("build_index.py")
        ok = self.run_script("build_index.py", "--check")
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        # add a new lesson (no frontmatter, manifest now stale)
        new = self.tmp / "phase_1_foundation" / "lesson_02_present_continuous"
        new.mkdir()
        (new / "lecture.md").write_text("# BÀI 2\n", encoding="utf-8")
        bad = self.run_script("build_index.py", "--check")
        self.assertEqual(bad.returncode, 1)
        self.assertIn("missing frontmatter", bad.stderr)
        self.assertIn("stale", bad.stderr)


if __name__ == "__main__":
    unittest.main()
