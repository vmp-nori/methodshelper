"""
index_textbook.py — Indexes the Methods 1&2 textbook PDF.

For each exercise found in the textbook:
  1. Renders the relevant pages to images
  2. Sends them to GPT-4o Vision to extract individual questions
  3. Does the same for the answers section at the back
  4. Uploads everything to the textbook_questions table in Supabase

Requirements (install on your Windows machine):
    pip install supabase pymupdf openai tqdm

Usage:
    set SUPABASE_SERVICE_KEY=your_service_role_key
    set OPENAI_API_KEY=your_openai_key
    python index_textbook.py

    # Or to index only specific exercises:
    python index_textbook.py --exercises 1A 1B 1C

    # Or to process a page range (useful for resuming):
    python index_textbook.py --start-page 50 --end-page 120

The script is safe to re-run — it skips questions already in the database.
"""

import os
import re
import sys
import json
import base64
import argparse
import tempfile
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL   = "https://rrpfggsrqlhyezcuyqmb.supabase.co"
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_KEY", "")
OPENAI_KEY     = os.environ.get("OPENAI_API_KEY", "")
MM_SUBJECT_ID  = "c57050cd-1a8b-43e7-91aa-45d502cfbc21"
PDF_PATH       = r"C:\Users\norin\Documents\Methods 1&2.pdf"
# Image resolution for PDF rendering (higher = clearer, but larger payloads)
RENDER_DPI     = 150
# GPT model to use
GPT_MODEL      = "gpt-4o"
# ────────────────────────────────────────────────────────────────────────────


EXTRACT_QUESTIONS_PROMPT = """
You are indexing a VCE Mathematical Methods textbook.
This image shows one or more pages from an exercise section.

Extract EVERY numbered question visible on this page(s).
For each question return:
- question_number: the integer question number (e.g. 1, 2, 3)
- question_text: the full text of the question, including any sub-parts (a, b, c).
  Use newlines between sub-parts. Preserve mathematical notation as text (e.g. x^2, sqrt(x), pi).
- has_diagram: true if the question includes a graph, diagram, or figure that cannot be fully
  described in text.

If a question has a diagram, still include as much text as possible in question_text, and
set has_diagram to true — the image crop will be stored separately.

Return ONLY a JSON array (no markdown), like:
[
  {"question_number": 1, "question_text": "Solve x^2 - 5x + 6 = 0", "has_diagram": false},
  {"question_number": 2, "question_text": "...", "has_diagram": false}
]

Include ONLY questions visible on this exact page — do not invent or hallucinate questions.
If no questions are visible, return [].
"""

EXTRACT_ANSWERS_PROMPT = """
You are indexing the answers section of a VCE Mathematical Methods textbook.
This image shows an answers page for Exercise {exercise}.

Extract every answer visible for Exercise {exercise}.
For each answer return:
- question_number: integer
- answer_text: the full answer text. For multi-part questions, include all parts
  separated by newlines like "a) 3  b) -2  c) x = 1". Preserve mathematical notation
  as text (e.g. x = 3/2, sqrt(5), 2pi).
- has_diagram: true if the answer contains a graph or figure.

Return ONLY a JSON array (no markdown), like:
[
  {"question_number": 1, "answer_text": "x = 2 or x = 3", "has_diagram": false},
  {"question_number": 2, "answer_text": "a) 5  b) -1", "has_diagram": false}
]

If no answers for Exercise {exercise} are visible on this page, return [].
"""

FIND_EXERCISES_PROMPT = """
This image shows a page (or pages) from a VCE Mathematical Methods textbook.

List every exercise section heading visible on this page.
Exercise headings look like "Exercise 1A", "Exercise 2B", "1A", etc.

Return ONLY a JSON array of strings, e.g.: ["1A", "1B"]
If no exercise headings are visible, return [].
"""


def page_to_base64(pdf_doc, page_num: int, dpi: int = RENDER_DPI) -> str:
    """Render a PDF page to a base64-encoded PNG."""
    import fitz
    page = pdf_doc[page_num]
    mat  = fitz.Matrix(dpi / 72, dpi / 72)
    pix  = page.get_pixmap(matrix=mat)
    png_bytes = pix.tobytes("png")
    return base64.b64encode(png_bytes).decode()


def call_gpt_vision(client, prompt: str, image_b64: str) -> str:
    """Send a page image to GPT-4o Vision and return the text response."""
    response = client.chat.completions.create(
        model=GPT_MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"}
                },
                {"type": "text", "text": prompt},
            ]
        }]
    )
    return response.choices[0].message.content.strip()


def parse_json_response(text: str) -> list:
    """Extract a JSON array from a GPT response, tolerating markdown fences."""
    # Strip ```json ... ``` if present
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find the first [...] block
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return []


def build_exercise_page_map(pdf_doc, openai_client, start_page=0, end_page=None) -> dict:
    """
    Scan the PDF to build a map of exercise → list of page numbers.
    Returns: {"1A": [44, 45], "1B": [46], ...}
    """
    import fitz
    total = len(pdf_doc)
    end   = min(end_page or total, total)
    print(f"\nScanning pages {start_page}–{end} for exercise headings…")

    exercise_map = {}
    for page_num in range(start_page, end):
        # Use PyMuPDF text extraction first (faster, free)
        page = pdf_doc[page_num]
        text = page.get_text()
        found_any = False

        for match in re.finditer(r'Exercise\s+(\d+[A-Za-z])', text, re.IGNORECASE):
            ex = match.group(1).upper()
            exercise_map.setdefault(ex, [])
            if page_num not in exercise_map[ex]:
                exercise_map[ex].append(page_num)
            found_any = True

        # If text extraction found nothing interesting but the page might have exercises
        # (common for pages with dense typesetting), fall back to GPT vision
        if not found_any and 'exercise' not in text.lower():
            # Skip obviously irrelevant pages (e.g. answers, contents)
            if any(kw in text.lower() for kw in ['answers', 'index', 'contents']):
                continue

        sys.stdout.write(f"\r  Page {page_num + 1}/{end} — found exercises: {sorted(exercise_map.keys())!r}  ")
        sys.stdout.flush()

    print(f"\n\nExercise page map ({len(exercise_map)} exercises):")
    for ex, pages in sorted(exercise_map.items()):
        print(f"  {ex}: pages {[p+1 for p in pages]}")

    return exercise_map


def find_answers_pages(pdf_doc) -> dict:
    """
    Find the answers section at the back of the textbook and map
    exercise labels to their answer page numbers.
    Returns: {"1A": [520], "1B": [520, 521], ...}
    """
    import fitz
    total = len(pdf_doc)
    # Answers are typically in the last 15–20% of the book
    start = int(total * 0.80)
    print(f"\nScanning pages {start}–{total} for answers section…")

    answer_map = {}
    in_answers = False

    for page_num in range(start, total):
        page = pdf_doc[page_num]
        text = page.get_text()

        if 'answers' in text.lower() and not in_answers:
            in_answers = True
            print(f"  Answers section starts around page {page_num + 1}")

        if not in_answers:
            continue

        for match in re.finditer(r'Exercise\s+(\d+[A-Za-z])', text, re.IGNORECASE):
            ex = match.group(1).upper()
            answer_map.setdefault(ex, [])
            if page_num not in answer_map[ex]:
                answer_map[ex].append(page_num)

        sys.stdout.write(f"\r  Page {page_num + 1}/{total}  ")
        sys.stdout.flush()

    print(f"\n  Found answers for: {sorted(answer_map.keys())}")
    return answer_map


def extract_questions_from_pages(openai_client, pdf_doc, pages: list[int]) -> list[dict]:
    """
    Send pages to GPT-4o and extract all questions.
    Combines results across multiple pages for the same exercise.
    """
    all_questions = {}
    for page_num in pages:
        img_b64  = page_to_base64(pdf_doc, page_num)
        response = call_gpt_vision(openai_client, EXTRACT_QUESTIONS_PROMPT, img_b64)
        items    = parse_json_response(response)
        for item in items:
            qn = item.get("question_number")
            if qn and qn not in all_questions:
                all_questions[qn] = item
    return list(all_questions.values())


def extract_answers_from_pages(openai_client, pdf_doc, exercise: str, pages: list[int]) -> list[dict]:
    """Send answer pages to GPT-4o and extract answers for a specific exercise."""
    all_answers = {}
    prompt = EXTRACT_ANSWERS_PROMPT.replace("{exercise}", exercise)
    for page_num in pages:
        img_b64  = page_to_base64(pdf_doc, page_num)
        response = call_gpt_vision(openai_client, prompt, img_b64)
        items    = parse_json_response(response)
        for item in items:
            qn = item.get("question_number")
            if qn and qn not in all_answers:
                all_answers[qn] = item
    return list(all_answers.values())


def get_already_indexed(supabase_client, exercise: str) -> set[int]:
    """Return question numbers already in the database for this exercise."""
    result = (
        supabase_client.table("textbook_questions")
        .select("question_number")
        .eq("subject_id", MM_SUBJECT_ID)
        .eq("exercise", exercise)
        .execute()
    )
    return {row["question_number"] for row in result.data}


def upload_questions(supabase_client, exercise: str, questions: list[dict], answers: dict):
    """Upsert question + answer rows into textbook_questions."""
    rows = []
    for q in questions:
        qn  = q.get("question_number")
        ans = answers.get(qn, {})
        rows.append({
            "subject_id":       MM_SUBJECT_ID,
            "exercise":         exercise,
            "question_number":  qn,
            "question_text":    q.get("question_text", ""),
            "question_image":   None,   # TODO: crop & store diagram images
            "answer_text":      ans.get("answer_text", ""),
            "answer_image":     None,
        })

    if rows:
        supabase_client.table("textbook_questions").upsert(
            rows,
            on_conflict="subject_id,exercise,question_number"
        ).execute()


def main():
    parser = argparse.ArgumentParser(description="Index Methods 1&2 textbook into Supabase")
    parser.add_argument("--pdf",         default=PDF_PATH,  help="Path to the PDF file")
    parser.add_argument("--exercises",   nargs="+",         help="Only process these exercises (e.g. 1A 1B)")
    parser.add_argument("--start-page",  type=int, default=0)
    parser.add_argument("--end-page",    type=int, default=None)
    args = parser.parse_args()

    if not SUPABASE_KEY:
        raise SystemExit("Set SUPABASE_SERVICE_KEY env var (service-role key from Supabase dashboard)")
    if not OPENAI_KEY:
        raise SystemExit("Set OPENAI_API_KEY env var")

    print(f"PDF: {args.pdf}")

    import fitz
    from supabase import create_client
    from openai import OpenAI

    pdf_doc        = fitz.open(args.pdf)
    supabase       = create_client(SUPABASE_URL, SUPABASE_KEY)
    openai_client  = OpenAI(api_key=OPENAI_KEY)

    print(f"PDF loaded: {len(pdf_doc)} pages")

    # Step 1: Build exercise → page map
    exercise_map = build_exercise_page_map(
        pdf_doc, openai_client,
        start_page=args.start_page,
        end_page=args.end_page,
    )

    # Step 2: Find answers pages
    answer_map = find_answers_pages(pdf_doc)

    # Step 3: Filter to requested exercises
    target_exercises = args.exercises or sorted(exercise_map.keys())
    print(f"\nIndexing {len(target_exercises)} exercises: {target_exercises}\n")

    # Step 4: For each exercise, extract questions + answers and upload
    for exercise in target_exercises:
        exercise = exercise.upper()
        q_pages  = exercise_map.get(exercise, [])
        a_pages  = answer_map.get(exercise, [])

        if not q_pages:
            print(f"[{exercise}] No question pages found — skipping")
            continue

        # Skip questions already indexed
        already  = get_already_indexed(supabase, exercise)
        print(f"[{exercise}] Question pages: {[p+1 for p in q_pages]} | "
              f"Answer pages: {[p+1 for p in a_pages]} | "
              f"Already indexed: {len(already)} questions")

        # Extract questions
        print(f"[{exercise}] Extracting questions via GPT-4o…")
        questions = extract_questions_from_pages(openai_client, pdf_doc, q_pages)
        new_questions = [q for q in questions if q["question_number"] not in already]
        print(f"[{exercise}] Found {len(questions)} questions ({len(new_questions)} new)")

        if not new_questions:
            print(f"[{exercise}] All questions already indexed, skipping\n")
            continue

        # Extract answers
        answers_by_num = {}
        if a_pages:
            print(f"[{exercise}] Extracting answers via GPT-4o…")
            raw_answers = extract_answers_from_pages(openai_client, pdf_doc, exercise, a_pages)
            answers_by_num = {a["question_number"]: a for a in raw_answers}
            print(f"[{exercise}] Found {len(answers_by_num)} answers")

        # Upload
        upload_questions(supabase, exercise, new_questions, answers_by_num)
        print(f"[{exercise}] ✓ Uploaded {len(new_questions)} questions\n")

    print("Indexing complete.")


if __name__ == "__main__":
    main()
