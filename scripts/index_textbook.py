"""
index_textbook.py — Indexes a VCE Math textbook PDF into the SUPsmasher Supabase project.

For each exercise (e.g. "Exercise 1A") found in the textbook:
  1. Renders the relevant pages to images (via PyMuPDF)
  2. Sends them to a local vision model via Ollama to extract questions and sub-parts
  3. Does the same for the answers section at the back
  4. Uploads everything to the textbook_questions table in Supabase

Chapter review sections ("Chapter N review", "Multiple-choice questions",
"Extended-response questions", "Technology-free/active") are intentionally skipped.

Requirements:
    pip install supabase pymupdf requests python-dotenv

    Ollama must be running locally with a multimodal model pulled.

Usage:
    # SUPABASE_SERVICE_KEY loaded from .env
    python index_textbook.py --subject MM12 --pdf "C:\\path\\to\\Methods 1&2.pdf"

    # Only specific exercises:
    python index_textbook.py --subject MM12 --pdf "..." --exercises 1A 1B 1C

    # Resume / override page boundaries:
    python index_textbook.py --subject MM12 --pdf "..." --start-page 50
    python index_textbook.py --subject MM12 --pdf "..." --answers-page 779

    # Re-process and overwrite already-indexed exercises:
    python index_textbook.py --subject MM12 --pdf "..." --exercises 1A --force

Safe to re-run — it skips exercises that already have indexed rows.
"""

import os
import re
import sys
import json
import base64
import argparse
import requests
from dotenv import load_dotenv

load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://bodwvpqtfhqmpzialpig.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
OLLAMA_URL   = os.environ.get("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4-e4b-128k:latest")
RENDER_DPI   = 150

SUBJECT_CODES = {
    "MM12": "Mathematical Methods 1&2",
    "MM34": "Mathematical Methods 3&4",
    "SM12": "Specialist Mathematics 1&2",
    "SM34": "Specialist Mathematics 3&4",
}

# A page with any of these markers starts a non-exercise section and
# breaks exercise-continuation so its content isn't attributed to the previous exercise.
CHAPTER_BREAK_RE = re.compile(
    r'(?i)(?:chapter\s+\d+\s+review'
    r'|multiple[-\s]*choice\s+questions'
    r'|extended[-\s]*response\s+questions'
    r'|technology[-\s]*free'
    r'|technology[-\s]*active'
    r'|short[-\s]*answer\s+questions'
    r'|investigations?)'
)

EXERCISE_RE = re.compile(r'Exercise\s+(\d+[A-Za-z])', re.IGNORECASE)
# ────────────────────────────────────────────────────────────────────────────


EXTRACT_QUESTIONS_PROMPT = """You are indexing a VCE Mathematical Methods textbook.
This image shows one or more pages from an exercise section.

Extract EVERY numbered question visible on the page.

For each question return an object with:
- "question_number": integer (e.g. 1, 2, 3)
- "main_text": the overall question stem (e.g. "Solve each of the following:").
  Use "" if the question has no stem and jumps straight into parts.
- "parts": object mapping sub-part labels to part objects. Use {} if no sub-parts.

Each part object has:
- "text": the text of that sub-part as plain text. Write math inline: "x^2 - 5x + 6".
- "subparts" (OPTIONAL): include ONLY if that part has further nested sub-parts
  (labelled with roman numerals i, ii, iii, iv, …). Maps each nested label to an
  object with "text".

Return ONLY a JSON array (no markdown fences, no commentary). Example:
[
  {
    "question_number": 1,
    "main_text": "Solve each of the following for x:",
    "parts": {
      "a": {"text": "x + 3 = 6"},
      "b": {"text": "x - 3 = 6"}
    }
  },
  {
    "question_number": 2,
    "main_text": "$48 is divided among three students A, B and C. If B receives three times as much as A, and C twice as much as A, how much does each receive?",
    "parts": {}
  },
  {
    "question_number": 4,
    "main_text": "",
    "parts": {
      "a": {"text": "Find the probability."},
      "b": {
        "text": "Prove each of the following:",
        "subparts": {
          "i": {"text": "n+m is even"},
          "ii": {"text": "n+m+1 is odd"}
        }
      }
    }
  }
]

Include ONLY questions visible on this exact page. Ignore chapter-review content,
multiple-choice questions, or extended-response questions. If no numbered exercise
questions are visible, return [].
"""

EXTRACT_ANSWERS_PROMPT = """You are indexing the answers section of a VCE Mathematical Methods textbook.
This image shows an answers page. Find the section for Exercise {exercise} only.

The answers are printed in a COMPACT INLINE format. Each question starts with its
number, then alternates part labels (a, b, c, ...) with their answers:

  1 a 3  b 9  c 1  d -8  e 5  f 2
  2 a+b  b a-b  c b/a  d ab                 <- Q2 has sub-part letters too
  3 a y=5  b t=5  c y=-3/2  d x=2

When a single part has further NESTED sub-parts, they are labelled with roman
numerals (i, ii, iii, iv, ...) listed inline after the part letter:

  4 a i 210  ii 100  iii 10/21  iv 10/21    <- Q4 part a has i–iv
  4 b i (n+m)(n+m-1)(n+m-2)(m+m-3)/24  ii mn(m-1)(n-1)/4  iii n = 4, 6, 8 or 10

Questions with NO sub-parts have the full answer right after the number:

  14 30, 6
  15 1.3775 m^2

Parse every question and sub-part carefully. DO NOT confuse part labels
(a, b, c, i, ii) with answer values.

For each question return:
- "question_number": integer
- "parts": object mapping part labels to answer data. Each value is ONE of:
    • a string — the direct answer for that part (e.g. "3", "x = 5", "b/a")
    • an object {"subparts": {...}} — when the part itself has nested answers
      (keys are roman numerals, values are answer strings)
- For questions with no sub-parts, use a single key "_" whose value is the full answer string.

Return ONLY a JSON array (no markdown fences). Example:
[
  {"question_number": 1, "parts": {"a": "3", "b": "9", "c": "1", "d": "-8"}},
  {"question_number": 2, "parts": {"a": "a+b", "b": "a-b", "c": "b/a", "d": "ab"}},
  {"question_number": 4, "parts": {
    "a": {"subparts": {"i": "210", "ii": "100", "iii": "10/21", "iv": "10/21"}},
    "b": {"subparts": {"i": "(n+m)(n+m-1)(n+m-2)(m+m-3)/24", "ii": "mn(m-1)(n-1)/4", "iii": "n = 4, 6, 8 or 10"}}
  }},
  {"question_number": 14, "parts": {"_": "30, 6"}}
]

Include ONLY answers that explicitly belong to Exercise {exercise}. Ignore answers
for any other exercise, chapter review, multiple-choice, or extended-response
section on this page. If Exercise {exercise} is not on this page, return [].
"""


# ── Parsing helpers ─────────────────────────────────────────────────────────

def parse_json_response(response: str) -> list:
    """Parse a JSON array out of an LLM response. Tolerates markdown fences."""
    text = response.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```\s*$', '', text)
        text = text.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        pass
    start = text.find('[')
    end   = text.rfind(']')
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(text[start:end + 1])
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError as e:
            print(f"    [warn] Failed to parse JSON: {e}")
    else:
        print(f"    [warn] No JSON array found in response")
    return []


def exercise_sort_key(ex: str):
    """Natural sort: '10A' comes after '9Z', not before '1B'."""
    m = re.match(r'(\d+)([A-Za-z]+)', ex)
    if not m:
        return (99999, ex)
    return (int(m.group(1)), m.group(2).upper())


# ── Ollama / PDF rendering ──────────────────────────────────────────────────

def page_to_base64(pdf_doc, page_num: int) -> str:
    """Render a PDF page to a base64-encoded PNG."""
    import fitz
    page = pdf_doc[page_num]
    mat  = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)
    pix  = page.get_pixmap(matrix=mat)
    return base64.b64encode(pix.tobytes("png")).decode()


def call_ollama_vision(prompt: str, image_b64: str) -> str:
    """Send a page image to the local Ollama model and return the response text."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{
            "role": "user",
            "content": prompt,
            "images": [image_b64],
        }],
        "stream": False,
    }
    print(f"    [Ollama] Sending page to {OLLAMA_MODEL}... (this may take 1-3 mins)")
    try:
        resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=600)
        resp.raise_for_status()
        content = resp.json()["message"]["content"].strip()
        print(f"    [Ollama] Response received ({len(content)} chars)")
        return content
    except requests.exceptions.Timeout:
        print(f"    [Error] Ollama timed out after 10 minutes.")
        raise
    except Exception as e:
        print(f"    [Error] Ollama request failed: {e}")
        raise


# ── Page-map builders ───────────────────────────────────────────────────────

def find_answers_section_start(pdf_doc) -> int:
    """
    Locate where the Answers section begins. We look for a page whose top text
    contains a standalone 'Answers' heading (as opposed to a running header like
    '806 Answers' which appears on every page of the answers section).
    """
    for page_num in range(len(pdf_doc)):
        text = pdf_doc[page_num].get_text()
        head = text[:500]
        # Strict: 'Answers' on its own line, not preceded by digits
        if re.search(r'(?m)^\s*Answers\s*$', head):
            return page_num
        if re.search(r'(?mi)^\s*Answers\s+to\s+Exercise', head):
            return page_num
    return len(pdf_doc)


def _scan_exercise_pages(pdf_doc, start: int, end: int, label: str) -> dict:
    """
    Walk pages [start, end) and build {exercise_code: [page_num, ...]}.
    A page with an 'Exercise XY' heading is assigned to XY. Pages without a
    heading carry forward to the most recent exercise UNLESS the page contains
    a chapter-review / technology-free / multiple-choice marker — those break
    the chain so review content isn't attributed to the previous exercise.
    """
    exercise_map = {}
    last_exercise = None
    total = end - start
    for page_num in range(start, end):
        text = pdf_doc[page_num].get_text()

        headings = [m.group(1).upper() for m in EXERCISE_RE.finditer(text)]
        is_break = CHAPTER_BREAK_RE.search(text) is not None

        if headings:
            for ex in headings:
                exercise_map.setdefault(ex, [])
                if page_num not in exercise_map[ex]:
                    exercise_map[ex].append(page_num)
            # Use the last heading on the page as the continuation anchor.
            # If a break marker also appears on this page AFTER the last heading,
            # we can't easily tell order from text alone, so be conservative and
            # reset the anchor so we don't over-extend into review content.
            last_exercise = None if is_break else headings[-1]
        elif is_break:
            last_exercise = None
        elif last_exercise is not None:
            if page_num not in exercise_map[last_exercise]:
                exercise_map[last_exercise].append(page_num)

        done = page_num - start + 1
        sys.stdout.write(f"\r  {label}: page {page_num + 1} ({done}/{total}) found {len(exercise_map)} exercises   ")
        sys.stdout.flush()
    sys.stdout.write("\n")
    return exercise_map


def build_exercise_page_map(pdf_doc, answers_start: int, start_page=0, end_page=None) -> dict:
    end = min(end_page or answers_start, answers_start)
    print(f"\nScanning pages {start_page + 1}–{end} for exercise headings (Questions Section)…")
    return _scan_exercise_pages(pdf_doc, start_page, end, "Questions")


def find_answers_pages(pdf_doc, answers_start: int) -> dict:
    total = len(pdf_doc)
    print(f"\nScanning pages {answers_start + 1}–{total} for Answers Section…")
    return _scan_exercise_pages(pdf_doc, answers_start, total, "Answers")


# ── Supabase ────────────────────────────────────────────────────────────────

def get_subject_id(supabase, subject_code: str) -> str:
    result = supabase.table("subjects").select("id").eq("code", subject_code).single().execute()
    if not result.data:
        raise SystemExit(f"Subject '{subject_code}' not found in database.")
    return result.data["id"]


def get_indexed_exercises(supabase, subject_id: str) -> set:
    """Return set of exercise codes that already have any rows for this subject."""
    result = (
        supabase.table("textbook_questions")
        .select("exercise")
        .eq("subject_id", subject_id)
        .execute()
    )
    return {row["exercise"] for row in result.data}


def delete_exercise_rows(supabase, subject_id: str, exercise: str):
    """Wipe all rows for a given exercise so --force can insert a clean set."""
    (
        supabase.table("textbook_questions")
        .delete()
        .eq("subject_id", subject_id)
        .eq("exercise", exercise)
        .execute()
    )


# ── Tree merging (questions + answers share the same nested-part structure) ─

def merge_subparts(existing: dict, new: dict) -> dict:
    """
    Merge two part-trees (as produced by Ollama). Existing wins on conflict.
    Used both to merge items from multiple pages, and to merge question-parts
    with answer-parts into a single final tree.
    """
    merged = dict(existing) if existing else {}
    for label, new_val in (new or {}).items():
        if label not in merged:
            merged[label] = new_val
            continue
        existing_val = merged[label]
        # If either side is a non-dict (plain answer string), don't merge deeper.
        if not isinstance(existing_val, dict) or not isinstance(new_val, dict):
            continue
        # Merge optional nested subparts
        if "subparts" in existing_val or "subparts" in new_val:
            e_sub = existing_val.get("subparts", {}) if isinstance(existing_val.get("subparts"), dict) else {}
            n_sub = new_val.get("subparts", {})      if isinstance(new_val.get("subparts"),      dict) else {}
            existing_val["subparts"] = merge_subparts(e_sub, n_sub)
        # Fill missing fields from new
        for k in ("text", "answer"):
            if k in new_val and not existing_val.get(k):
                existing_val[k] = new_val[k]
    return merged


def merge_question_items(existing: dict, new: dict):
    """Merge two extractions for the same question_number (across pages)."""
    if not existing.get("main_text") and new.get("main_text"):
        existing["main_text"] = new["main_text"]
    existing["parts"] = merge_subparts(existing.get("parts", {}), new.get("parts", {}))


def merge_answer_items(existing: dict, new: dict):
    existing["parts"] = merge_subparts(existing.get("parts", {}), new.get("parts", {}))


# ── Extraction ──────────────────────────────────────────────────────────────

def extract_questions_from_pages(pdf_doc, pages: list) -> dict:
    all_questions = {}
    for i, page_num in enumerate(pages):
        print(f"  [Q {i+1}/{len(pages)}] Page {page_num + 1}…")
        img_b64  = page_to_base64(pdf_doc, page_num)
        response = call_ollama_vision(EXTRACT_QUESTIONS_PROMPT, img_b64)
        items    = parse_json_response(response)
        print(f"    [ok] parsed {len(items)} question(s)")
        for item in items:
            qn = item.get("question_number")
            if not isinstance(qn, int):
                continue
            if qn in all_questions:
                merge_question_items(all_questions[qn], item)
            else:
                all_questions[qn] = {
                    "question_number": qn,
                    "main_text":       item.get("main_text", "") or "",
                    "parts":           item.get("parts", {}) or {},
                }
            stem = all_questions[qn].get("main_text", "")[:60]
            print(f"      - Q{qn}: {stem}" + ("…" if len(stem) == 60 else ""))
    return all_questions


def extract_answers_from_pages(pdf_doc, exercise: str, pages: list) -> dict:
    all_answers = {}
    prompt = EXTRACT_ANSWERS_PROMPT.replace("{exercise}", exercise)
    for i, page_num in enumerate(pages):
        print(f"  [A {i+1}/{len(pages)}] Page {page_num + 1}…")
        img_b64  = page_to_base64(pdf_doc, page_num)
        response = call_ollama_vision(prompt, img_b64)
        items    = parse_json_response(response)
        print(f"    [ok] parsed {len(items)} answer block(s)")
        for item in items:
            qn = item.get("question_number")
            if not isinstance(qn, int):
                continue
            if qn in all_answers:
                merge_answer_items(all_answers[qn], item)
            else:
                all_answers[qn] = {
                    "question_number": qn,
                    "parts":           item.get("parts", {}) or {},
                }
            print(f"      - A{qn}")
    return all_answers


# ── Combine question+answer into final nested part tree ────────────────────

def _normalize_answer_node(ap) -> dict:
    """Turn a raw answer-tree value into a dict with possible 'answer'/'subparts'."""
    if isinstance(ap, str):
        return {"answer": ap}
    if isinstance(ap, dict):
        out = {}
        if "answer" in ap and isinstance(ap["answer"], str):
            out["answer"] = ap["answer"]
        if "subparts" in ap and isinstance(ap["subparts"], dict):
            out["subparts"] = {k: _normalize_answer_node(v) for k, v in ap["subparts"].items()}
        return out
    return {}


def _normalize_question_node(qp) -> dict:
    """Turn a raw question-tree value into a dict with possible 'text'/'subparts'."""
    if isinstance(qp, str):
        return {"text": qp}
    if isinstance(qp, dict):
        out = {}
        if "text" in qp and isinstance(qp["text"], str):
            out["text"] = qp["text"]
        if "subparts" in qp and isinstance(qp["subparts"], dict):
            out["subparts"] = {k: _normalize_question_node(v) for k, v in qp["subparts"].items()}
        return out
    return {}


def combine_question_and_answer(q_parts: dict, a_parts: dict) -> dict:
    """
    Walk question-parts and answer-parts in parallel, producing a unified tree
    where every node has the fields present: text, answer, subparts.
    """
    q_parts = q_parts or {}
    a_parts = a_parts or {}
    labels  = set(q_parts.keys()) | set(a_parts.keys())
    out = {}
    for label in sorted(labels):
        q = _normalize_question_node(q_parts.get(label))
        a = _normalize_answer_node(a_parts.get(label))
        node = {}
        if q.get("text"):
            node["text"] = q["text"]
        if a.get("answer"):
            node["answer"] = a["answer"]
        q_sub = q.get("subparts") or {}
        a_sub = a.get("subparts") or {}
        if q_sub or a_sub:
            node["subparts"] = combine_question_and_answer(q_sub, a_sub)
        out[label] = node
    return out


# ── Upload ──────────────────────────────────────────────────────────────────

def upload_questions(supabase, subject_id: str, exercise: str, questions: dict, answers: dict):
    rows = []
    for qn, q in sorted(questions.items()):
        a = answers.get(qn, {})
        q_parts = q.get("parts", {}) or {}
        a_parts = a.get("parts", {}) or {}

        # For questions with no sub-parts, the answer lives under the "_" sentinel.
        answer_text = ""
        if not q_parts and isinstance(a_parts, dict):
            under = a_parts.get("_")
            if isinstance(under, str):
                answer_text = under
            elif isinstance(under, dict):
                answer_text = under.get("answer", "") if isinstance(under.get("answer"), str) else ""

        # Build the nested tree (excluding the "_" sentinel which is mirrored in answer_text)
        a_parts_for_tree = {k: v for k, v in a_parts.items() if k != "_"}
        parts_tree = combine_question_and_answer(q_parts, a_parts_for_tree)

        rows.append({
            "subject_id":      subject_id,
            "exercise":        exercise,
            "question_number": qn,
            "question_text":   q.get("main_text", "") or "",
            "answer_text":     answer_text,
            "parts":           parts_tree,
        })

    if rows:
        supabase.table("textbook_questions").upsert(
            rows, on_conflict="subject_id,exercise,question_number"
        ).execute()


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Index a VCE Math textbook into SUPsmasher")
    parser.add_argument("--subject",      required=True, choices=list(SUBJECT_CODES.keys()))
    parser.add_argument("--pdf",          required=True, help="Path to the PDF file")
    parser.add_argument("--exercises",    nargs="+",     help="Only process these exercises (e.g. 1A 1B)")
    parser.add_argument("--start-page",   type=int, default=0)
    parser.add_argument("--end-page",     type=int, default=None)
    parser.add_argument("--answers-page", type=int, default=None,
                        help="1-indexed page where the Answers section starts (auto-detected if omitted)")
    parser.add_argument("--ollama-model", default=None, help="Override Ollama model name")
    parser.add_argument("--force", action="store_true",
                        help="Delete and re-index exercises that are already indexed")
    args = parser.parse_args()

    if not SUPABASE_KEY:
        raise SystemExit("Set SUPABASE_SERVICE_KEY env var (service-role key from Supabase dashboard)")

    global OLLAMA_MODEL
    if args.ollama_model:
        OLLAMA_MODEL = args.ollama_model

    # Verify Ollama is reachable
    try:
        requests.get(f"{OLLAMA_URL}/api/tags", timeout=5).raise_for_status()
    except Exception as e:
        raise SystemExit(f"Cannot reach Ollama at {OLLAMA_URL}: {e}\nMake sure Ollama is running.")

    print(f"Subject : {args.subject} — {SUBJECT_CODES[args.subject]}")
    print(f"PDF     : {args.pdf}")
    print(f"Model   : {OLLAMA_MODEL} via {OLLAMA_URL}")

    import fitz
    from supabase import create_client

    pdf_doc    = fitz.open(args.pdf)
    supabase   = create_client(SUPABASE_URL, SUPABASE_KEY)
    subject_id = get_subject_id(supabase, args.subject)

    print(f"PDF loaded: {len(pdf_doc)} pages | Subject ID: {subject_id}\n")

    if args.answers_page is not None:
        answers_start = args.answers_page - 1
        print(f"Answers section start: page {args.answers_page} (from --answers-page)")
    else:
        answers_start = find_answers_section_start(pdf_doc)
        if answers_start >= len(pdf_doc):
            print("No 'Answers' heading detected — treating entire PDF as questions section.")
        else:
            print(f"Answers section detected at page {answers_start + 1}")

    exercise_map = build_exercise_page_map(pdf_doc, answers_start, args.start_page, args.end_page)
    answer_map   = find_answers_pages(pdf_doc, answers_start)

    target_exercises = args.exercises or sorted(exercise_map.keys(), key=exercise_sort_key)
    target_exercises = [ex.upper() for ex in target_exercises]
    already = get_indexed_exercises(supabase, subject_id)

    print(f"\nIndexing {len(target_exercises)} exercises: {target_exercises}\n")

    for exercise in target_exercises:
        q_pages = exercise_map.get(exercise, [])
        a_pages = answer_map.get(exercise, [])

        if not q_pages:
            print(f"[{exercise}] No question pages found — skipping")
            continue

        print(f"[{exercise}] Q pages: {[p+1 for p in q_pages]}  "
              f"A pages: {[p+1 for p in a_pages]}  "
              f"Already indexed: {exercise in already}")

        if exercise in already:
            if not args.force:
                print(f"[{exercise}] Already indexed — skipping (use --force to reindex)\n")
                continue
            print(f"[{exercise}] --force: deleting existing rows…")
            delete_exercise_rows(supabase, subject_id, exercise)

        print(f"[{exercise}] Extracting questions…")
        questions = extract_questions_from_pages(pdf_doc, q_pages)
        print(f"[{exercise}] Got {len(questions)} question(s)")

        if not questions:
            print(f"[{exercise}] No questions extracted — skipping\n")
            continue

        answers = {}
        if a_pages:
            print(f"[{exercise}] Extracting answers…")
            answers = extract_answers_from_pages(pdf_doc, exercise, a_pages)
            print(f"[{exercise}] Got {len(answers)} answer block(s)")

        upload_questions(supabase, subject_id, exercise, questions, answers)
        print(f"[{exercise}] ✓ Uploaded {len(questions)} question(s)\n")

    print("Indexing complete.")


if __name__ == "__main__":
    main()
