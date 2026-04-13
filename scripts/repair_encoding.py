"""
repair_encoding.py — Fixes mojibake (encoding errors) in the textbook_questions table.

It identifies characters like 'â€“' (en-dash), 'â€™' (smart quote), etc., 
and repairs them by re-encoding them correctly as UTF-8.
"""

import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = "https://bodwvpqtfhqmpzialpig.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_KEY:
    raise SystemExit("Set SUPABASE_SERVICE_KEY env var")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Common mojibake patterns
# â€“ (UTF-8 bytes E2 80 93) -> en-dash –
# â€™ (UTF-8 bytes E2 80 99) -> smart quote ’
# â€œ (UTF-8 bytes E2 80 9C) -> smart quote “
# â€ (UTF-8 bytes E2 80 9D) -> smart quote ”

def repair_string(s):
    if not s:
        return s
    try:
        # If it contains common mojibake signatures, try to fix it
        if "â" in s:
            # Re-encode as CP1252 to get raw bytes, then decode as UTF-8
            return s.encode('cp1252').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        # If a simple re-encode/decode fails, just do a manual replacement for common ones
        replacements = {
            "â€“": "–",
            "â€™": "’",
            "â€œ": "“",
            "â€": "”",
            "â€¦": "…",
            "â": "—", # Fallback for em-dash if needed
        }
        for old, new in replacements.items():
            s = s.replace(old, new)
    return s

def repair_parts(parts):
    if not parts:
        return parts
    
    new_parts = {}
    for label, node in parts.items():
        new_node = dict(node)
        if "text" in new_node:
            new_node["text"] = repair_string(new_node["text"])
        if "answer" in new_node:
            new_node["answer"] = repair_string(new_node["answer"])
        if "subparts" in new_node:
            new_node["subparts"] = repair_parts(new_node["subparts"])
        new_parts[label] = new_node
    return new_parts

def main():
    print("Fetching all questions to check for encoding issues...")
    result = supabase.table("textbook_questions").select("*").execute()
    rows = result.data
    print(f"Checking {len(rows)} rows...")

    updated_count = 0
    for row in rows:
        original_stem = row["question_text"]
        original_parts = row["parts"]
        original_answer = row["answer_text"]

        new_stem = repair_string(original_stem)
        new_parts = repair_parts(original_parts)
        new_answer = repair_string(original_answer)

        if new_stem != original_stem or new_parts != original_parts or new_answer != original_answer:
            print(f"Repairing Q{row['question_number']} in Ex {row['exercise']}...")
            supabase.table("textbook_questions").update({
                "question_text": new_stem,
                "parts": new_parts,
                "answer_text": new_answer
            }).eq("id", row["id"]).execute()
            updated_count += 1

    print(f"\nFinished! Repaired {updated_count} questions.")

if __name__ == "__main__":
    main()
