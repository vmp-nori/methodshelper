# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

Python scripts (run locally, not in cloud environment):
```bash
# Migrate MM SUPs from nori.study → SUPsmasher (one-time migration)
SOURCE_SERVICE_KEY=<nori.study service-role key> \
DEST_SERVICE_KEY=<SUPsmasher service-role key> \
python scripts/migrate_sups.py

# Index a textbook PDF into Supabase using local Ollama
python scripts/index_textbook.py --subject MM12 --pdf "path/to/Methods 1&2.pdf"

# Parse SUP .docx files from Supabase Storage (legacy — use migrate_sups.py instead)
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

### Supabase projects

There are two Supabase projects:
- **SUPsmasher** (`bodwvpqtfhqmpzialpig.supabase.co`) — the database this app reads from
- **nori.study** (`rrpfggsrqlhyezcuyqmb.supabase.co`) — a separate platform; source of SUP `.docx` files in its `methods` storage bucket. Uses subject code `"MM"` (not `"MM12"`).

### Key data tables (SUPsmasher)

- **`subjects`** — one row per textbook (MM12, MM34, SM12, SM34), pre-seeded
- **`sup_data`** — per-topic exercise lists: `{ topic_code, topic_name, exercises: [{exercise, questions: [1,3,5]}] }`
- **`textbook_questions`** — indexed questions: `{ subject_id, exercise, question_number, question_text, answer_text, question_image, answer_image }`

### Frontend structure

- `App.jsx` — top-level router with three state vars: `subject`, `selectedTopic`, `sessionConfig`
- `pages/TextbookSelect.jsx` — 2×2 card grid; calls `onSelect(subject)`
- `pages/TopicSelect.jsx` — pill-row topic list + right "Unit Plan" panel; calls `onSelect(topic)`. No sidebar — has its own SUPsmasher wordmark + "Change textbook" button in the top bar. Uses Space Grotesk font (loaded in `index.html`). Stitch reference: "Unit Selection with Plan" screen saved in `.stitch/`.
- `pages/Home.jsx` — session config only (exercise range + skip pattern + start); receives `topic` directly, no longer fetches topics
- `pages/Session.jsx` — main study loop; keyboard-driven (Space/Enter = advance, ←→ = navigate, Esc = back)
- `lib/questions.js` — all Supabase queries; `buildQuestionList(exercises, skipEvery, skipOffset)` applies the skip filter
- `lib/math.jsx` — `<MathText>` component: parses `$...$` (inline) and `$$...$$` (display) LaTeX via KaTeX
- `components/Sidebar.jsx` — icon nav used by `Home` and `Session` only (not `TopicSelect`)

### Page routing flow

```
TextbookSelect → TopicSelect → Home (session config) → Session
     subject         topic          sessionConfig
```

`App.jsx` gates: no subject → TextbookSelect; subject but no topic → TopicSelect; both → Home; sessionConfig set → Session.

### Session config object

Passed from `Home` → `App` → `Session`:
```js
{ topic, startExerciseIndex, subjectId, skipEvery, skipOffset }
// skipEvery=1 all, =2 every other, =3 every third
// skipOffset=0 odd questions, =1 even questions
```

### Subject ID caveat

`src/lib/questions.js` has `MM_SUBJECT_ID` hardcoded to the SUPsmasher UUID. This must match the `id` in the `subjects` table for `code = 'MM12'`. If the project is re-created, query `subjects` and update the constant. The current correct UUID is `16c7e006-688c-4c2a-b086-1c9926cf2fd6`.

### SUP docx format

The nori.study SUP files use a table with a "Test Yourself" column. Each cell contains entries like:
```
Ex 2B - Q3, Q4a, Q5, Q6.
Ex 2C - Q4, Q5, Q6ac, Q8b
```
`migrate_sups.py` parses this with an `Ex \d+[A-Za-z]+` / `Q\d+` regex — it extracts the integer question number only (ignoring sub-parts like `a`, `b`, `c`). Extension questions (listed in parentheses like `(Extension Q8, Q9)`) are intentionally excluded — parenthetical content is stripped before parsing.

### Indexing scripts

`index_textbook.py` requires `SUPABASE_SERVICE_KEY` (service-role key, not anon key) and calls Ollama at `http://localhost:11434` (override with `OLLAMA_URL` / `OLLAMA_MODEL` env vars, default model: `gemma3`).  
`migrate_sups.py` requires `SOURCE_SERVICE_KEY` (nori.study) and `DEST_SERVICE_KEY` (SUPsmasher). Safe to re-run — uses upsert.
