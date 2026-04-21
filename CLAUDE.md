# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

Deploy to production:
```bash
vercel deploy --prod --yes
# Then re-point the alias (must be done after every deploy):
vercel alias set methodshelper.vercel.app supsmasher.vercel.app
```

Python scripts (run locally, not in cloud):
```bash
SUPABASE_SERVICE_KEY=<service-role key> \
python _local/scripts/import_questions.py --input /path/to/output.json --subject MM12

SOURCE_SERVICE_KEY=<nori.study key> DEST_SERVICE_KEY=<SUPsmasher key> \
python _local/scripts/migrate_sups.py

python _local/scripts/index_textbook.py --subject MM12 --pdf "path/to/Methods 1&2.pdf"
```

## Architecture

Single-page React app, no backend — all data lives in Supabase (PostgreSQL).
Hosted on Vercel at **https://supsmasher.vercel.app** (alias) and **https://methodshelper.vercel.app** (canonical).

### Data flow

```
SUP .docx files  → migrate_sups.py       → sup_data table
Textbook PDF     → index_textbook.py
                   + import_questions.py  → textbook_questions table
                                                     ↓
                                         React app ← Supabase JS client
```

### Supabase projects

- **SUPsmasher** (`bodwvpqtfhqmpzialpig.supabase.co`) — production DB this app reads from
- **nori.study** (`rrpfggsrqlhyezcuyqmb.supabase.co`) — legacy platform; source of SUP `.docx` files

### Key tables (SUPsmasher)

- **`subjects`** — one row per textbook (MM12, MM34, SM12, SM34), pre-seeded
- **`sup_data`** — `{ topic_code, topic_name, exercises: [{exercise, questions: [1,3,5]}] }`
- **`textbook_questions`** — `{ subject_id, exercise, question_number, question_text, answer_text, parts (JSONB), question_image, answer_image }`

**`parts` JSONB schema:**
```json
{
  "a": { "text": "...", "answer": "", "subparts": {
    "i":  { "text": "...", "answer": "" }
  }},
  "b": { "text": "..." }
}
```

**Data status:** MM12 has 1,117 questions across 128 exercises (1A–10F). `answer_text` and `parts[x].answer` are empty — answers not yet extracted. MM34/SM12/SM34 have no questions yet.

## Frontend structure

### Files

- `src/main.jsx` — entry; wraps `<App>` in `<BrowserRouter>`
- `src/App.jsx` — route table + global overlays (mobile wordmark, bug report button + modal)
- `src/lib/hooks.js` — `useIsMobile()` hook (breakpoint: 768px, updates on resize)
- `src/lib/questions.js` — all Supabase queries + `buildQuestionList()`
- `src/lib/math.jsx` — `<MathText>` component: renders `$...$` and `$$...$$` via KaTeX
- `src/lib/supabase.js` — Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- `src/pages/TextbookSelect.jsx` — 2×2 card grid (collapses to 1 col on mobile)
- `src/pages/TopicSelect.jsx` — topic list + fixed 320px "Unit Plan" right panel (hidden on mobile)
- `src/pages/Home.jsx` — session config card (exercise dropdown + filter grid + start button)
- `src/pages/Session.jsx` — main study loop; keyboard-driven; QuestionPanel right sidebar (drawer on mobile)
- `src/components/BugReportModal.jsx` — issue report modal; submits via Supabase Edge Function `send-bug-report`
- `src/components/Sidebar.jsx` — **unused** (was removed from Session; kept in repo)
- `vercel.json` — rewrites all paths to `index.html` for SPA routing

### Page routing

React Router v7. URL structure:

```
/                                → TextbookSelect
/:subjectCode                    → TopicSelect      (e.g. /MM12)
/:subjectCode/:topicCode         → Home             (e.g. /MM12/1)
/:subjectCode/:topicCode/session → Session          (e.g. /MM12/1/session)
```

Navigation passes objects via router state (`navigate(path, { state: { subject, topic } })`).
On direct URL / refresh, pages fetch data from Supabase using URL params as keys.
Session shows "no session" screen if `location.state?.config` is missing (can't reconstruct from URL).

### Global overlays (App.jsx)

- **Wordmark** (mobile only, `position: fixed`, top-left) — shown on all sub-routes, clicking → `/`. Hidden on desktop; desktop pages have their own headers.
- **Dark shield** (mobile only, `position: fixed`, top 64px, `zIndex: 940`) — sits behind the wordmark so scrolling content doesn't bleed through it.
- **⚑ bug report button** (`position: fixed`, bottom-right, `zIndex: 900`) — opens `BugReportModal`. Safe-area-aware on iOS.

### Session layout

Desktop: `[Main content area] [QuestionPanel 280px]`  
Mobile: Full-width main; QuestionPanel becomes a slide-in drawer toggled by ▦ button.

Main content splits vertically:
- **Upper half** (`justifyContent: flex-end`): question stem + sub-part card — anchored above centre line
- **Divider**: 1px line at centre
- **Lower half** (`justifyContent: flex-start`): answer card — revealed with `answerReveal` + `borderGlow` animations

Desktop header (top-left): topic name label + large "Ex X · QN" text.  
Mobile header: ▦ toggle (left) + topic name + "Ex X · QN" right-aligned (right). Top padding 72px to clear wordmark shield.

**Phases:** `PHASE.QUESTION` → `PHASE.ANSWER`. Advancing from answer on a multi-part question goes to next sub-part, not next question.

**Keyboard:** Space/Enter = advance, ←→ = navigate, Esc = back.

### Question filter options

```js
{ label: 'All questions', skipEvery: 1, skipOffset: 0 }
{ label: 'Every other',   skipEvery: 2, skipOffset: 0 }
{ label: 'Every third',   skipEvery: 3, skipOffset: 0 }
{ label: 'End on last',   skipEvery: 2, endOnLast: true }
```

`endOnLast` picks the offset per exercise that causes the last question to always be included.

### Design system

Dark theme, inline styles throughout (no CSS modules, Tailwind is installed but not used):
- **Backgrounds:** `#0e0e0e` (page), `#131313` (card), `#171717` (surface), `#1f2020` (raised)
- **Accent:** `#c799ff`
- **Text:** `#e7e5e5` (primary), `#9f9d9d` (secondary), `#484848` (muted), `#333` (very muted)
- **Borders:** `rgba(72,72,72,0.08–0.15)`
- **Fonts:** Space Grotesk (headings/numbers), Inter (body/labels)

### Mobile responsiveness

All pages use `useIsMobile()` (from `src/lib/hooks.js`) to conditionally swap inline style values. Breakpoint: 768px. No CSS media queries — everything is conditional inline.

### Subject ID

MM12 UUID in SUPsmasher: `16c7e006-688c-4c2a-b086-1c9926cf2fd6`. Not hardcoded — passed through session config. If project is re-created, query `subjects` table.

### Deployment

Vercel project: `norinheng86-6186s-projects/methodshelper`  
Env vars set in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`  
`vercel alias` is used to point `supsmasher.vercel.app` at the latest deployment — must be re-run after every `vercel deploy --prod`.
