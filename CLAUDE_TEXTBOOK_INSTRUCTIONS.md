# Claude Instruction: Textbook Indexing & Sub-part Support

## Objective
Update the `methodshelper` project to support structured textbook questions (main question + sub-parts a, b, c) and automate diagram extraction using a local Gemma 4 26B VLM via Ollama.

---

## 1. Database Schema Update (Action Required)
Run this SQL in the Supabase SQL Editor to add the `parts` JSONB column:

```sql
ALTER TABLE public.textbook_questions 
ADD COLUMN IF NOT EXISTS parts JSONB DEFAULT '{}'::jsonb;
```

---

## 2. Code Changes Needed

### A. Update `scripts/index_textbook.py`
- **Model**: Default `OLLAMA_MODEL` to `gemma4-26b`.
- **Prompts**: Rewrite `EXTRACT_QUESTIONS_PROMPT` and `EXTRACT_ANSWERS_PROMPT` to return structured JSON:
  - `main_text`: The overall question stem (e.g., "Factorise:").
  - `parts`: An object mapping labels (a, b, c) to `{ "text": "...", "answer": "...", "bbox": [y1, x1, y2, x2] }`.
- **Diagrams**: 
  - If the model returns a `bbox`, use `page.get_pixmap(clip=...)` from PyMuPDF to crop the image.
  - Upload crops to Supabase Storage (bucket: `textbook_images`).
  - Store the URL in the `parts` object.
- **Upload**: Update `upload_questions` to merge questions and answers by their sub-part labels before upserting.

### B. Update `src/lib/questions.js`
- Update `fetchQuestionsForSession` to include the `parts` column in the query.
- Ensure the data structure returned to the UI is stable (sorting sub-parts alphabetically).

### C. Update `src/pages/Session.jsx`
- **State**: Add `subPartIndex` to track the active part (a, b, c).
- **UI**: 
  - Display `current.question_text` (the stem) at the top.
  - Render the active sub-part (e.g., "a) ...") below it.
  - Update keyboard listeners (ArrowRight/Left) to cycle through sub-parts before moving to the next question number.
  - Space/Enter should reveal the answer for the *current* sub-part.

---

## 3. Execution Command
Once implemented, run the indexer:

```bash
set SUPABASE_SERVICE_KEY=your_service_role_key
python scripts/index_textbook.py --subject MM12 --pdf "C:\path\to\Methods 1&2.pdf" --exercises 1A
```

## 4. Design & LaTeX Requirements
- All math must be wrapped in `$` or `$$` for KaTeX rendering.
- Ensure sub-parts are handled hierarchically (main stem -> sub-parts -> sub-sub-parts i, ii).
- Keep the UI clean, matching the existing "Space Grotesk" aesthetic.
