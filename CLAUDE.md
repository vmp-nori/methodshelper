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
# Import extracted textbook questions into Supabase (re-run safely — uses upsert)
SUPABASE_SERVICE_KEY=<service-role key> \
python scripts/import_questions.py \
  --input /path/to/output.json \
  --subject MM12

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
SUP .docx files  → migrate_sups.py  → sup_data table
Textbook PDF     → index_textbook.py (Ollama/Gemma vision)
                   + import_questions.py (from output.json) → textbook_questions table
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
- **`textbook_questions`** — indexed questions: `{ subject_id, exercise, question_number, question_text, answer_text, parts (JSONB), question_image, answer_image }`

**textbook_questions `parts` JSONB schema:**
```json
{
  "a": { "text": "...", "answer": "", "subparts": {
    "i":  { "text": "...", "answer": "" },
    "ii": { "text": "...", "answer": "" }
  }},
  "b": { "text": "..." }
}
```
Sub-parts (roman numerals) use the `subparts` key. Questions without sub-parts have an empty `parts` object and carry their text in `question_text` / `answer_text` directly.

**Current data status (MM12):** 1,117 questions across 128 exercises (1A–10F) imported. Answers not yet extracted — `answer_text` and `parts[x].answer` are empty strings. Re-run `import_questions.py` once answers are available; the upsert updates in place.

### Frontend structure

- `App.jsx` — top-level router with state vars: `subject`, `selectedTopic`, `sessionConfig`, `reportOpen`, `reportContext`. Routes via a `let page` pattern (not early returns). Renders a fixed floating report button (bottom-right) and `BugReportModal` on every page.
- `pages/TextbookSelect.jsx` — 2×2 card grid; calls `onSelect(subject)`
- `pages/TopicSelect.jsx` — pill-row topic list + right "Unit Plan" panel; calls `onSelect(topic)`. No sidebar — has its own SUPsmasher wordmark + "Change textbook" button in the top bar. Uses Space Grotesk font (loaded in `index.html`).
- `pages/Home.jsx` — session config (exercise range + question filter + start); receives `topic` prop directly. Contains inline `ExerciseDropdown` component (animated custom dropdown). Has four skip-filter options (All / Every other / Every third / End on last).
- `pages/Session.jsx` — main study loop; keyboard-driven (Space/Enter = advance, ←→ = navigate, Esc = back). Contains inline `QuestionPanel` component (right sidebar, 280px). Accepts `onReport` prop from App.
- `lib/questions.js` — all Supabase queries; `buildQuestionList(exercises, skipEvery, skipOffset, endOnLast)` applies the skip filter
- `lib/math.jsx` — `<MathText>` component: parses `$...$` (inline) and `$$...$$` (display) LaTeX via KaTeX
- `components/Sidebar.jsx` — icon nav used by `Session` only
- `components/BugReportModal.jsx` — modal for reporting issues; type picker (6 options), optional description textarea, auto-captured context display. Submits via Supabase Edge Function `send-bug-report`. Triggered globally via the floating ⚑ button in `App.jsx`.

### Page routing flow

React Router (`react-router-dom`) handles all navigation. URL structure:

```
/                              → TextbookSelect
/:subjectCode                  → TopicSelect   (e.g. /MM12)
/:subjectCode/:topicCode       → Home          (e.g. /MM12/1)
/:subjectCode/:topicCode/session → Session     (e.g. /MM12/1/session)
```

`vercel.json` rewrites all paths to `index.html` so deep links and refreshes work.

Each page receives subject/topic objects via React Router navigation state (`navigate(path, { state: { subject, topic } })`). If state is absent (direct URL / browser refresh), pages fetch data from Supabase using the URL params as keys. Session redirects back if config state is missing (config can't be reconstructed from URL).

### Session config object

Passed from `Home` → `App` → `Session`:
```js
{
  topic,              // full topic object from sup_data
  startExerciseIndex, // index into topic.exercises[] to begin from
  subjectId,          // UUID of the subject (MM12 etc.)
  skipEvery,          // 1=all, 2=every other, 3=every third
  skipOffset,         // 0=start from first question
  endOnLast,          // true=ensure last question per exercise is always included
}
```

`endOnLast` dynamically picks the offset per exercise so the final question is always included regardless of parity. Used by the "End on last" filter option in Home.jsx.

### Session layout

`Session.jsx` uses a three-column layout:
```
[Sidebar] [Main content area] [QuestionPanel 280px]
```

The main content area splits vertically into two equal halves:
- **Upper half** (`justifyContent: flex-end`): question number + stem + sub-part card — anchored to the centre line from above, never moves
- **Thin divider line**: visual anchor at the centre
- **Lower half** (`justifyContent: flex-start`): answer card — revealed with `answerReveal` + `borderGlow` CSS animations, anchored to centre line from below

This ensures the question stays fixed on screen when the answer is revealed.

**Session phases:** `PHASE.QUESTION` → `PHASE.ANSWER`. For questions with parts, advancing from answer moves to the next sub-part (resetting phase to QUESTION), not the next question.

**`QuestionPanel`** (right aside): groups questions by exercise, shows progress bar, clickable question number buttons to jump, ESC hint.

### Question filter options (Home.jsx)

```js
const SKIP_OPTIONS = [
  { label: 'All questions', desc: 'a, b, c, d…',       skipEvery: 1, skipOffset: 0 },
  { label: 'Every other',   desc: 'a, c, e, g…',       skipEvery: 2, skipOffset: 0 },
  { label: 'Every third',   desc: 'a, d, g, j…',       skipEvery: 3, skipOffset: 0 },
  { label: 'End on last',   desc: 'every other + last', skipEvery: 2, endOnLast: true },
]
```

### Design system

Dark theme throughout, inline styles (no CSS modules or Tailwind):
- **Backgrounds:** `#0e0e0e` (page), `#131313` (card), `#171717` (surface), `#1f2020` (raised surface)
- **Accent purple:** `#c799ff`
- **Text:** `#e7e5e5` (primary), `#9f9d9d` (secondary), `#484848` (muted), `#333` (very muted)
- **Borders:** `rgba(72,72,72,0.08–0.15)`
- **Fonts:** Space Grotesk (headings/numbers), Inter (body/labels)

### Subject ID caveat

`src/lib/questions.js` has no hardcoded subject ID — subject ID is passed through from session config. The MM12 UUID in SUPsmasher is `16c7e006-688c-4c2a-b086-1c9926cf2fd6`. If the project is re-created, query `subjects` and update references accordingly.

### SUP docx format

The nori.study SUP files use a table with a "Test Yourself" column. Each cell contains entries like:
```
Ex 2B - Q3, Q4a, Q5, Q6.
Ex 2C - Q4, Q5, Q6ac, Q8b
```
`migrate_sups.py` parses this with an `Ex \d+[A-Za-z]+` / `Q\d+` regex — it extracts the integer question number only (ignoring sub-parts like `a`, `b`, `c`). Extension questions (listed in parentheses like `(Extension Q8, Q9)`) are intentionally excluded — parenthetical content is stripped before parsing.

### import_questions.py

Imports textbook questions from `output.json` (produced by Gemini Vision or `index_textbook.py`) into `textbook_questions`. Key behaviours:
- Strips `*` prefix from extension question numbers (e.g., `*11` → `11`)
- Converts recursive `sub_questions[]` → `parts{}` JSONB with `subparts` nesting
- Deduplicates by `(subject_id, exercise, question_number)` before upsert — keeps last occurrence
- Batches upsert in groups of 100 rows
- Safe to re-run: uses `on_conflict="subject_id,exercise,question_number"`

### Indexing scripts

`index_textbook.py` requires `SUPABASE_SERVICE_KEY` (service-role key, not anon key) and calls Ollama at `http://localhost:11434` (override with `OLLAMA_URL` / `OLLAMA_MODEL` env vars, default model: `gemma3`).  
`migrate_sups.py` requires `SOURCE_SERVICE_KEY` (nori.study) and `DEST_SERVICE_KEY` (SUPsmasher). Safe to re-run — uses upsert.
