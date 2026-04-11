# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

Python indexing scripts (run from your local machine, not the cloud environment):
```bash
# Index a textbook PDF into Supabase using local Ollama
python scripts/index_textbook.py --subject MM12 --pdf "path/to/Methods 1&2.pdf"

# Parse SUP .docx files from Supabase Storage
python scripts/parse_sups.py
```

## Architecture

This is a single-page React app with no backend — all data lives in Supabase (PostgreSQL).

### Data flow

```
SUP .docx files → parse_sups.py → sup_data table
Textbook PDF    → index_textbook.py (Ollama/Gemma vision) → textbook_questions table
                                                                      ↓
                                              React app reads via Supabase JS client
```

### Key data tables (SUPsmasher Supabase project: `bodwvpqtfhqmpzialpig.supabase.co`)

- **`subjects`** — one row per textbook (MM12, MM34, SM12, SM34), pre-seeded
- **`sup_data`** — per-topic exercise lists: `{ topic_code, topic_name, exercises: [{exercise, questions: [1,3,5]}] }`
- **`textbook_questions`** — indexed questions: `{ subject_id, exercise, question_number, question_text, answer_text, question_image, answer_image }`

### Frontend structure

- `App.jsx` — top-level router: toggles between `<Home>` and `<Session>` via `sessionConfig` state
- `pages/Home.jsx` — topic picker, exercise range selector, skip-pattern selector; calls `onStart(config)`
- `pages/Session.jsx` — main study loop; keyboard-driven (Space/Enter = advance, ←→ = navigate, Esc = back)
- `lib/questions.js` — all Supabase queries; `buildQuestionList(exercises, skipEvery, skipOffset)` applies the skip filter
- `lib/math.jsx` — `<MathText>` component: parses `$...$` (inline) and `$$...$$` (display) LaTeX via KaTeX
- `components/Sidebar.jsx` — purely decorative nav, no routing logic yet

### Session config object

Passed from `Home` → `App` → `Session`:
```js
{ topic, startExerciseIndex, skipEvery, skipOffset }
// skipEvery=1 all, =2 every other, =3 every third
// skipOffset=0 odd questions, =1 even questions
```

### Subject ID caveat

`src/lib/questions.js` has `MM_SUBJECT_ID` hardcoded. This must be updated if the Supabase project is re-created (query `subjects` table for the real UUID).

### Indexing scripts

Both scripts require `SUPABASE_SERVICE_KEY` env var (service-role key, not anon key).  
`index_textbook.py` calls Ollama at `http://localhost:11434` (override with `OLLAMA_URL` / `OLLAMA_MODEL` env vars, default model: `gemma3`).  
`parse_sups.py` downloads `.docx` SUP files from the `methods` Supabase Storage bucket.
