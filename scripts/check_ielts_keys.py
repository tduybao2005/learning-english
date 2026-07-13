#!/usr/bin/env python3
"""Cross-check each IELTS test's answer key against its own reading.md.

Why this exists
---------------
`scripts/seed/seed-placement.ts` records that test_01's answer key was checked
question-by-question against the passage and does NOT match it: the key marks Q2
FALSE where the passage says TRUE, and labels Q14-18 "True/False/Not Given" where
reading.md actually asks for matching headings. The keys are boilerplate from the
test-bank's generation process, not verified per passage.

Grading a learner against a wrong key is worse than not grading at all, so before
any IELTS grading feature ships we need to know which tests are trustworthy.

What this can and cannot prove
------------------------------
It checks *structural* agreement only:
  - does reading.md declare 40 questions, and does the key answer all of them?
  - does each key answer have a legal FORM for the question type reading.md
    declares? (TFNG must be TRUE/FALSE/NOT GIVEN, matching-headings must be a
    roman numeral, MCQ must be A-D, ...)

It CANNOT prove an answer is factually right. test_01's Q2 (FALSE where the
passage says TRUE) is a legal TFNG value — no script can catch that without
reading the passage. So a PASS here means "worth a human check", never "verified".
FAIL means "definitely broken".

Usage:  python3 scripts/check_ielts_keys.py [--verbose]
"""

import argparse
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
TESTS = REPO / "ielts_practice_tests"

ROMAN = re.compile(r"^[ivx]+$", re.I)
LETTER = re.compile(r"^[A-J]$")

# Question-type detection from reading.md's own instruction prose.
KIND_PATTERNS = [
    ("YNNG", re.compile(r"\bYES\b.*\bNO\b.*\bNOT GIVEN\b", re.S | re.I)),
    ("TFNG", re.compile(r"\bTRUE\b.*\bFALSE\b.*\bNOT GIVEN\b", re.S | re.I)),
    ("HEADINGS", re.compile(r"list of headings|correct heading", re.I)),
    ("MATCH_PARA", re.compile(r"which paragraph|matching (information|features)", re.I)),
    ("MCQ", re.compile(r"choose the correct letter", re.I)),
    ("COMPLETION", re.compile(
        r"no more than|complete the (summary|sentences|notes|table)|one word", re.I)),
]

# Which answer forms are legal for each declared question type.
def legal(kind: str, ans: str) -> bool:
    a = ans.strip().strip("*").strip()
    if not a:
        return False
    if kind == "TFNG":
        return a.upper() in {"TRUE", "FALSE", "NOT GIVEN"}
    if kind == "YNNG":
        return a.upper() in {"YES", "NO", "NOT GIVEN"}
    if kind == "HEADINGS":
        return bool(ROMAN.match(a.split()[0].rstrip(".")))
    if kind == "MATCH_PARA":
        return bool(LETTER.match(a.split()[0].rstrip(".")))
    if kind == "MCQ":
        return bool(LETTER.match(a.split()[0].rstrip(".")))
    if kind == "COMPLETION":
        # Free text: any word can be the answer, INCLUDING "false" — test_16 Q40
        # is the gap in "detailed ___ memories" and the answer really is the word
        # "false". Judging a completion answer on its own is therefore impossible;
        # contamination is a property of the whole group, not one cell, so it is
        # checked in `contaminated()` below instead.
        return True
    return True  # unknown type: cannot judge, don't punish


TF_TOKENS = {"TRUE", "FALSE", "NOT GIVEN", "YES", "NO"}


def contaminated(kind: str, answers: list[str]) -> bool:
    """Is this group's key answering a True/False task the paper never asked?

    The test_01 signature: reading.md asks for headings or gap-fills across a
    whole group, and the key answers TRUE/FALSE/NOT GIVEN for ALL of them — it is
    keyed to a different paper. One stray "false" in a gap-fill group is a real
    word, not contamination, so require a clear majority.
    """
    if kind in {"TFNG", "YNNG", "UNKNOWN"} or not answers:
        return False
    hits = sum(1 for a in answers if a.strip().strip("*").upper() in TF_TOKENS)
    return hits > len(answers) / 2


# Group headers are not written consistently across the 30 tests:
#   ### Questions 1–5
#   #### Questions 1–6: True / False / Not Given
#   **Questions 7–10: Complete the sentences below. ...**
# so match the "Questions a-b" marker itself, whatever decorates it.
GROUP_RE = re.compile(r"^[#*\s]*Questions?\s+(\d+)\s*[–—-]\s*(\d+)", re.M)


def parse_reading(md: str):
    """-> ({qnum: kind}, [(lo, hi, kind)]). A group is a `Questions a-b` marker
    plus its instruction prose. Groups are returned too, because contamination is
    a property of a whole group, not of one answer."""
    out = {}
    groups = []
    heads = list(GROUP_RE.finditer(md))
    for i, h in enumerate(heads):
        lo, hi = int(h.group(1)), int(h.group(2))
        body = md[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(md)]
        kind = next((k for k, pat in KIND_PATTERNS if pat.search(body)), "UNKNOWN")
        groups.append((lo, hi, kind))
        for q in range(lo, hi + 1):
            out[q] = kind
    return out, groups


# The answer column is not fixed. Tables come in several shapes, in both
# English and Vietnamese, e.g.
#   | Q | Answer | Explanation |               -> answer in "Answer"
#   | Q | Paragraph | Correct Heading | Why |  -> answer in "Correct Heading"
#   | Q | Đoạn | Đáp án | Tiêu đề |            -> answer in "Đáp án"  (NOT "Đoạn")
# Picking the wrong one makes a valid key look broken, so match by header name,
# most specific first.
ANSWER_HEADERS = ("đáp án", "answer", "correct heading", "heading", "tiêu đề")


def parse_key(md: str):
    """-> {qnum: answer}.

    Only reads tables that declare an answer column, which also keeps the
    raw-score->band conversion table (`| Số câu đúng | Band IELTS |`) out of the
    results — its rows look just like answer rows.
    """
    out = {}
    col = None
    for line in md.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        # Some keys bold the question number (`| **1** |`), so strip markdown
        # from every cell before deciding what it is.
        cells = [re.sub(r"[*_`]", "", c).strip() for c in line.strip().strip("|").split("|")]
        if not cells or set("".join(cells)) <= set("-: "):  # separator row
            continue
        head = [c.lower() for c in cells]
        if not cells[0].isdigit():  # header row: re-arm (or disarm) the parser
            col = next((head.index(w) for w in ANSWER_HEADERS if w in head), None)
            continue
        if col is not None and len(cells) > col:
            out[int(cells[0])] = cells[col]

    # Some keys use a numbered list instead of a table ("1. TRUE"). Only used to
    # fill gaps, so a key that has both keeps its table as the source of truth.
    for m in re.finditer(r"^\s*(\d{1,2})\.\s+(.+?)\s*$", md, re.M):
        q = int(m.group(1))
        if 1 <= q <= 40 and q not in out:
            out[q] = re.sub(r"[*_`]", "", m.group(2)).strip()
    return out


def check(d: pathlib.Path, verbose: bool):
    r = d / "reading.md"
    k = d / "answer_key.md"
    if not r.exists() or not k.exists():
        return "NO_PARSE", ["thiếu reading.md hoặc answer_key.md"]

    kinds, groups = parse_reading(r.read_text(encoding="utf-8"))
    answers = parse_key(k.read_text(encoding="utf-8"))
    problems = []

    if not kinds:
        return "NO_PARSE", ["không parse được block '### Questions a–b' nào trong reading.md"]

    missing = sorted(set(kinds) - set(answers))
    if missing:
        problems.append(f"key thiếu đáp án cho {len(missing)} câu: {missing[:8]}")

    unknown = sorted(q for q, kd in kinds.items() if kd == "UNKNOWN")
    if unknown:
        problems.append(f"không nhận ra dạng câu hỏi cho {len(unknown)} câu: {unknown[:8]}")

    # Whole groups keyed to a different paper (the test_01 signature).
    for lo, hi, kind in groups:
        got = [answers[q] for q in range(lo, hi + 1) if q in answers]
        if contaminated(kind, got):
            problems.append(
                f"Q{lo}–{hi}: đề hỏi {kind} nhưng key trả lời True/False "
                f"→ key này viết cho một đề KHÁC"
            )

    bad = []
    for q, kind in sorted(kinds.items()):
        if q in answers and kind != "UNKNOWN" and not legal(kind, answers[q]):
            bad.append(f"Q{q} dạng {kind} nhưng key ghi {answers[q]!r}")
    if bad:
        problems.append(f"{len(bad)} câu có đáp án SAI DẠNG")
        if verbose:
            problems += ["    " + b for b in bad]
        else:
            problems += ["    " + b for b in bad[:4]]

    n = len(kinds)
    if n != 40:
        problems.append(f"reading.md khai {n} câu (chuẩn IELTS là 40)")

    return ("PASS" if not problems else "FAIL"), problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    rows = []
    for d in sorted(TESTS.glob("test_*")):
        status, problems = check(d, args.verbose)
        rows.append((d.name, status, problems))

    for name, status, problems in rows:
        mark = {"PASS": "✅ ĐẠT", "FAIL": "❌ LỆCH", "NO_PARSE": "⚠️  KHÔNG PARSE"}[status]
        print(f"{mark}  {name}")
        for p in problems:
            print(f"        {p}")

    n = len(rows)
    ok = sum(1 for _, s, _ in rows if s == "PASS")
    print(f"\n{'='*60}\nĐẠT {ok}/{n}   LỆCH {sum(1 for _,s,_ in rows if s=='FAIL')}"
          f"   KHÔNG PARSE {sum(1 for _,s,_ in rows if s=='NO_PARSE')}")
    print("Lưu ý: ĐẠT = cấu trúc hợp lệ, KHÔNG có nghĩa đáp án đúng về nội dung.")

    # test_01 is known-bad (hand-verified in seed-placement.ts). If the script
    # calls it clean, the script is wrong.
    t1 = next((s for n_, s, _ in rows if n_ == "test_01" for s in [s]), None)
    if t1 == "PASS":
        print("\n‼️  test_01 được chấm ĐẠT, nhưng nó đã được dò tay và biết là SAI."
              "\n    => script này chưa đủ nhạy, đừng tin kết quả.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
