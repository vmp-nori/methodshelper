"""
index_textbook.py — Indexes a VCE Math textbook PDF into the SUPsmasher Supabase project.

For each exercise found in the textbook:
  1. Renders the relevant pages to images (via PyMuPDF)
  2. Sends them to a local Gemma model via Ollama to extract questions + sub-parts
  3. Does the same for the answers section at the back
  4. Crops any diagrams and uploads them to Supabase Storage (bucket: textbook_images)
  5. Uploads everything to the textbook_questions table in Supabase

Requirements:
    pip install supabase pymupdf requests tqdm

    Ollama must be running locally with a multimodal model pulled:
        ollama pull gemma4-26b      (or whichever vision model you use)

Usage:
    set SUPABASE_SERVICE_KEY=your_service_role_key
    python index_textbook.py --subject MM12 --pdf "C:\\path\\to\\Methods 1&2.pdf"

    # Index only specific exercises:
    python index_textbook.py --subject MM12 --pdf "..." --exercises 1A 1B 1C

    # Resume from a specific page:
    python index_textbook.py --subject MM12 --pdf "..." --start-page 50

The script is safe to re-run — it skips questions already in the database.
"""

import os
import re
import sys
import json
import base64
import argparse
import requests

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL   = "https://bodwvpqtfhqmpzialpig.supabase.co"
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_KEY", "")
OLLAMA_URL     = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL   = os.environ.get("OLLAMA_MODEL", "gemma4-26b")
RENDER_DPI     = 150
STORAGE_BUCKET = "textbook_images"

SUBJECT_CODES = {
    "MM12": "Mathematical Methods 1&2",
    "MM34": "Mathematical Methods 3&4",
    "SM12": "Specialist Mathematics 1&2",
    "SM34": "Specialist Mathematics 3&4",
}
# ────────────────────────────────────────────────────────────────────────────


EXTRACT_QUESTIONS_PROMPT = """You are indexing a VCE Mathematical Methods textbook.
This image shows one or more pages from an exercise section.

Extract EVERY numbered question visible on this page.
For each question return:
- question_number: the integer question number (e.g. 1, 2, 3)
- main_text: the overall question stem (e.g. "Factorise each of the following:").
  If there is no stem and the question is just a list of parts, use "".
- parts: an object mapping sub-part labels (a, b, c, ...) to their content.
  Each part must have:
    "text": the sub-part text (math as plain text, e.g. "x^2 - 5x + 6")
    "bbox": [y1, x1, y2, x2] bounding box in POINTS (0,0 = top-left of the page)
            for any diagram/graph associated with this part. null if no diagram.
  If the question has no sub-parts, use an empty object {}.
- has_diagram: true if ANY part of the question contains a graph or diagram.

Return ONLY a JSON array (no markdown fences), like:
[
  {
    "question_number": 1,
    "main_text": "Factorise each of the following:",
    "parts": {
      "a": {"text": "x^2 - 5x + 6", "bbox": null},
      "b": {"text": "2x^2 + 3x - 2", "bbox": null}
    },
    "has_diagram": false
  },
  {
    "question_number": 2,
    "main_text": "Solve for x:",
    "parts": {},
    "has_diagram": false
  }
]

Include ONLY questions visible on this exact page. If none are visible, return [].
"""

EXTRACT_ANSWERS_PROMPT = """You are indexing the answers section of a VCE Mathematical Methods textbook.
This image shows an answers page for Exercise {exercise}.

Extract every answer visible for Exercise {exercise}.
For each answer return:
- question_number: integer
- parts: an object mapping sub-part labels (a, b, c, ...) to their answers.
  Each part must have:
    "answer": the answer text (math as plain text)
    "bbox": [y1, x1, y2, x2] bounding box in POINTS for any diagram in the answer.
             null if no diagram.
  If the question has no sub-parts, use {"_": {"answer": "<full answer text>", "bbox": null}}.
- has_diagram: true if the answer contains a graph or figure.

Return ONLY a JSON array (no markdown fences), like:
[
  {
    "question_number": 1,
    "parts": {
      "a": {"answer": "x = 2 or x = 3", "bbox": null},
      "b": {"answer": "x = -2 or x = 1/2", "bbox": null}
    },
    "has_diagram": false
  }
]

If no answers for Exercise {exercise} are visible on this page, return [].
"""


def page_to_base64(pdf_doc, page_num: int) -> str:
    """Render a PDF page to a base64-encoded PNG."""
    import fitz
    page = pdf_doc[page_num]
    mat  = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)
    pix  = page.get_pixmap(matrix=mat)
    return base64.b64encode(pix.tobytes("png")).decode()


def crop_and_upload(supabase, pdf_doc, page_num: int, bbox: list, path: str) -> str | None:
    """
    Crop a region from a PDF page and upload it to Supabase Storage.
    bbox: [y1, x1, y2, x2] in PDF points.
    Returns the public URL, or None on failure.
    """
    try:
        import fitz
        page = pdf_doc[page_num]
        # fitz.Rect is (x0, y0, x1, y1)
        y1, x1, y2, x2 = bbox
        rect = fitz.Rect(x1, y1, x2, y2)
        mat  = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)
        pix  = page.get_pixmap(matrix=mat, clip=rect)
        img_bytes = pix.tobytes("png")
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path, img_bytes, {"content-type": "image/png", "upsert": "true"}
        )
        public_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(path)
        return public_url
    except Exception as e:
        print(f"    [warn] Failed to crop/upload diagram: {e}")
        return None


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
    resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=180)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def parse_json_response(text: str) -> list:
    """Extract a JSON array from a model response, tolerating markdown fences."""
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return []


def build_exercise_page_map(pdf_doc, start_page=0, end_page=None) -> dict:
    """
    Scan PDF text to build a map of exercise → list of page numbers.
    Returns: {"1A": [44, 45], "1B": [46], ...}
    """
    total = len(pdf_doc)
    end   = min(end_page or total, total)
    print(f"\nScanning pages {start_page + 1}–{end} for exercise headings…")

    exercise_map = {}
    for page_num in range(start_page, end):
        text = pdf_doc[page_num].get_text()
        for match in re.finditer(r'Exercise\s+(\d+[A-Za-z])', text, re.IGNORECASE):
            ex = match.group(1).upper()
            exercise_map.setdefault(ex, [])
            if page_num not in exercise_map[ex]:
                exercise_map[ex].append(page_num)
        sys.stdout.write(f"\r  Page {page_num + 1}/{end}  found: {sorted(exercise_map.keys())}  ")
        sys.stdout.flush()

    print(f"\n\nExercise page map ({len(exercise_map)} exercises):")
    for ex, pages in sorted(exercise_map.items()):
        print(f"  {ex}: pages {[p + 1 for p in pages]}")

    return exercise_map


def find_answers_pages(pdf_doc) -> dict:
    """
    Scan the back of the PDF for answers sections.
    Returns: {"1A": [520], "1B": [520, 521], ...}
    """
    total   = len(pdf_doc)
    start   = int(total * 0.80)
    print(f"\nScanning pages {start + 1}–{total} for answers section…")

    answer_map  = {}
    in_answers  = False

    for page_num in range(start, total):
        text = pdf_doc[page_num].get_text()
        if not in_answers and 'answers' in text.lower():
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


def extract_questions_from_pages(pdf_doc, pages: list) -> list:
    all_questions = {}
    for page_num in pages:
        img_b64  = page_to_base64(pdf_doc, page_num)
        response = call_ollama_vision(EXTRACT_QUESTIONS_PROMPT, img_b64)
        for item in parse_json_response(response):
            qn = item.get("question_number")
            if qn and qn not in all_questions:
                item["_page_num"] = page_num
                all_questions[qn] = item
    return list(all_questions.values())


def extract_answers_from_pages(pdf_doc, exercise: str, pages: list) -> list:
    all_answers = {}
    prompt = EXTRACT_ANSWERS_PROMPT.replace("{exercise}", exercise)
    for page_num in pages:
        img_b64  = page_to_base64(pdf_doc, page_num)
        response = call_ollama_vision(prompt, img_b64)
        for item in parse_json_response(response):
            qn = item.get("question_number")
            if qn and qn not in all_answers:
                item["_page_num"] = page_num
                all_answers[qn] = item
    return list(all_answers.values())


def get_subject_id(supabase, subject_code: str) -> str:
    result = supabase.table("subjects").select("id").eq("code", subject_code).single().execute()
    if not result.data:
        raise SystemExit(f"Subject '{subject_code}' not found in database.")
    return result.data["id"]


def get_already_indexed(supabase, subject_id: str, exercise: str) -> set:
    result = (
        supabase.table("textbook_questions")
        .select("question_number")
        .eq("subject_id", subject_id)
        .eq("exercise", exercise)
        .execute()
    )
    return {row["question_number"] for row in result.data}


def upload_questions(supabase, pdf_doc, subject_id: str, exercise: str, questions: list, answers: dict):
    """
    Merge questions + answers by sub-part, crop any diagrams, then upsert to DB.
    """
    rows = []
    for q in questions:
        qn       = q.get("question_number")
        q_page   = q.get("_page_num")
        ans_data = answers.get(qn, {})
        a_page   = ans_data.get("_page_num")

        q_parts = q.get("parts", {})
        a_parts = ans_data.get("parts", {})

        # Merge question parts with answer parts
        merged_parts = {}
        all_labels = sorted(set(list(q_parts.keys()) + list(a_parts.keys())))

        for label in all_labels:
            qp = q_parts.get(label, {})
            ap = a_parts.get(label, {})

            part_entry = {
                "text":   qp.get("text", ""),
                "answer": ap.get("answer", ""),
            }

            # Crop question diagram if bbox provided
            if q_page is not None and qp.get("bbox"):
                path = f"{subject_id}/{exercise}/q{qn}_{label}_q.png"
                url  = crop_and_upload(supabase, pdf_doc, q_page, qp["bbox"], path)
                if url:
                    part_entry["image"] = url

            # Crop answer diagram if bbox provided
            if a_page is not None and ap.get("bbox"):
                path = f"{subject_id}/{exercise}/q{qn}_{label}_a.png"
                url  = crop_and_upload(supabase, pdf_doc, a_page, ap["bbox"], path)
                if url:
                    part_entry["answer_image"] = url

            merged_parts[label] = part_entry

        # Handle no-parts answers stored under "_" sentinel
        answer_text = ""
        if not q_parts and "_" in a_parts:
            answer_text = a_parts["_"].get("answer", "")

        rows.append({
            "subject_id":      subject_id,
            "exercise":        exercise,
            "question_number": qn,
            "question_text":   q.get("main_text", ""),
            "question_image":  None,
            "answer_text":     answer_text,
            "answer_image":    None,
            "parts":           merged_parts,
        })

    if rows:
        supabase.table("textbook_questions").upsert(
            rows, on_conflict="subject_id,exercise,question_number"
        ).execute()


def main():
    parser = argparse.ArgumentParser(description="Index a VCE Math textbook into SUPsmasher")
    parser.add_argument("--subject",    required=True, choices=list(SUBJECT_CODES.keys()),
                        help="Subject code: MM12, MM34, SM12, SM34")
    parser.add_argument("--pdf",        required=True, help="Path to the PDF file")
    parser.add_argument("--exercises",  nargs="+",     help="Only process these exercises (e.g. 1A 1B)")
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page",   type=int, default=None)
    parser.add_argument("--ollama-model", default=None, help="Override Ollama model name")
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

    exercise_map     = build_exercise_page_map(pdf_doc, args.start_page, args.end_page)
    answer_map       = find_answers_pages(pdf_doc)
    target_exercises = args.exercises or sorted(exercise_map.keys())

    print(f"\nIndexing {len(target_exercises)} exercises: {target_exercises}\n")

    for exercise in target_exercises:
        exercise = exercise.upper()
        q_pages  = exercise_map.get(exercise, [])
        a_pages  = answer_map.get(exercise, [])

        if not q_pages:
            print(f"[{exercise}] No question pages found — skipping")
            continue

        already = get_already_indexed(supabase, subject_id, exercise)
        print(f"[{exercise}] Q pages: {[p+1 for p in q_pages]}  "
              f"A pages: {[p+1 for p in a_pages]}  "
              f"Already indexed: {len(already)}")

        print(f"[{exercise}] Extracting questions via {OLLAMA_MODEL}…")
        questions     = extract_questions_from_pages(pdf_doc, q_pages)
        new_questions = [q for q in questions if q["question_number"] not in already]
        print(f"[{exercise}] Found {len(questions)} questions ({len(new_questions)} new)")

        if not new_questions:
            print(f"[{exercise}] All already indexed — skipping\n")
            continue

        answers_by_num = {}
        if a_pages:
            print(f"[{exercise}] Extracting answers via {OLLAMA_MODEL}…")
            raw_answers    = extract_answers_from_pages(pdf_doc, exercise, a_pages)
            answers_by_num = {a["question_number"]: a for a in raw_answers}
            print(f"[{exercise}] Found {len(answers_by_num)} answers")

        upload_questions(supabase, pdf_doc, subject_id, exercise, new_questions, answers_by_num)
        print(f"[{exercise}] ✓ Uploaded {len(new_questions)} questions\n")

    print("Indexing complete.")


if __name__ == "__main__":
    main()
