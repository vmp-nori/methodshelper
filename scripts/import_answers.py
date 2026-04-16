import os
import json
import argparse
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# SUPsmasher Supabase project configuration
SUPABASE_URL = "https://bodwvpqtfhqmpzialpig.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def clean_latex(text):
    """Fixes excessive backslashes from LLM output."""
    if not text: return text
    # The LLM sometimes outputs 4 backslashes in JSON (which parses to 2), KaTeX only needs 1.
    return text.replace('\\\\', '\\')

def merge_parts(existing_parts, new_parts_data):
    """
    Merges answers from the JSON data into the existing parts object.
    Supports both old (array of sub_answers) and new v2 (dict of parts) formats.
    """
    if not new_parts_data:
        return existing_parts

    updated_parts = existing_parts or {}

    # Handle v2 format: dict of parts {"a": {"text": "...", "answer": "..."}}
    if isinstance(new_parts_data, dict):
        for label, data in new_parts_data.items():
            if label not in updated_parts:
                updated_parts[label] = {"text": "", "answer": "", "subparts": {}}
            updated_parts[label]['answer'] = clean_latex(data.get('answer', '')) or updated_parts[label].get('answer', '')
            if data.get('subparts'):
                updated_parts[label]['subparts'] = merge_parts(
                    updated_parts[label].get('subparts', {}),
                    data['subparts']
                )

    # Handle v1 format: list of sub_answers [{"label": "a", "answer": "..."}]
    elif isinstance(new_parts_data, list):
        for sa in new_parts_data:
            label = sa['label']
            if label not in updated_parts:
                updated_parts[label] = {"text": "", "answer": "", "subparts": {}}
            updated_parts[label]['answer'] = clean_latex(sa.get('answer', '')) or updated_parts[label].get('answer', '')
            if sa.get('sub_answers'):
                updated_parts[label]['subparts'] = merge_parts(
                    updated_parts[label].get('subparts', {}),
                    sa['sub_answers']
                )

    return updated_parts

def main():
    parser = argparse.ArgumentParser(description="Merge answers from extracted_answers.json into the textbook_questions table")
    parser.add_argument("--input", required=True, help="Path to extracted_answers.json")
    parser.add_argument("--subject", default="MM12", help="Subject code (e.g., MM12)")
    args = parser.parse_args()

    if not SUPABASE_KEY:
        raise SystemExit("Error: SUPABASE_SERVICE_KEY environment variable not set.")

    if not os.path.exists(args.input):
        raise SystemExit(f"Error: File not found: {args.input}")

    print(f"Loading answers from: {args.input}")
    with open(args.input, encoding='utf-8') as f:
        data = json.load(f)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Get Subject ID
    print(f"Looking up subject '{args.subject}'...")
    subj = supabase.table("subjects").select("id").eq("code", args.subject).single().execute()
    if not subj.data:
        raise SystemExit(f"Error: Subject code '{args.subject}' not found in database.")
    subject_id = subj.data["id"]

    for exercise_entry in data:
        # Handle "Exercise 1A" -> "1A"
        ex_label = exercise_entry['exercise'].replace('Exercise ', '').strip()
        print(f"\nExercise {ex_label}:")

        # 2. Fetch all existing questions for this exercise to merge with
        existing_rows = supabase.table("textbook_questions")\
            .select("*")\
            .eq("subject_id", subject_id)\
            .eq("exercise", ex_label)\
            .execute()

        # Map DB results by number for quick lookup
        db_map = { r['question_number']: r for r in existing_rows.data }

        # Check for both "questions" (v2) and "answers" (v1) arrays
        questions_data = exercise_entry.get('questions', exercise_entry.get('answers', []))

        updates = []
        for ans_entry in questions_data:
            # Strip * from numbers if present
            q_num_str = str(ans_entry['number']).lstrip('*')

            # Skip range questions (e.g., "1-3")
            if '-' in q_num_str:
                print(f"  [Skip] Q{q_num_str} is a range question, skipping.")
                continue

            q_num = int(q_num_str)

            if q_num not in db_map:
                print(f"  [Skip] Q{q_num} not found in database. Please index the question stems first.")
                continue

            existing_row = db_map[q_num]

            # 3. Merge Answer Data into existing structure
            # Check for both "parts" (v2) and "sub_answers" (v1) formats
            parts_data = ans_entry.get('parts', ans_entry.get('sub_answers', []))
            answer_val = clean_latex(ans_entry.get('answer', ''))

            updated_row = {
                "id": existing_row["id"], # Critical for upserting an update
                "subject_id": subject_id,
                "exercise": ex_label,
                "question_number": q_num,
                "answer_text": answer_val or existing_row.get('answer_text', ''),
                "parts": merge_parts(existing_row.get('parts', {}), parts_data)
            }
            updates.append(updated_row)

        # 4. Batch Upsert (Supabase performs an update because ID is provided)
        if updates:
            print(f"  Updating {len(updates)} questions...")
            supabase.table("textbook_questions").upsert(updates).execute()
            print(f"  [OK] Successfully merged answers for Exercise {ex_label}.")

    print("\nAll exercises processed. Database updated.")

if __name__ == "__main__":
    main()
