# GEMINI.md

Guidance for Gemini CLI when working in the `methodshelper` (SUPsmasher) repository.
See **STATUS.md** for current bugs, backlog, and recent changes before starting any task.

## What this project is

**SUPsmasher** is a VCE maths study tool for JMSS students. It indexes textbook questions from PDFs into Supabase and serves them through a keyboard-driven web interface. Students select a textbook → topic → configure a session → practice questions one by one with answers revealed on demand.

Live at: **https://supsmasher.vercel.app**

## Tech stack

- **Frontend:** React 19, Vite 8, React Router v7
- **Styling:** Inline styles only — no CSS modules, no Tailwind in use (installed but unused)
- **Math:** KaTeX via `<MathText>` component (`src/lib/math.jsx`) — wraps `$...$` and `$$...$$`
- **Data:** Supabase JS client (`@supabase/supabase-js`)
- **Fonts:** Space Grotesk (headings/numbers), Inter (body)
- **Hosting:** Vercel — deploy with `vercel deploy --prod --yes`

## Key commands

```bash
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build → dist/
npm run lint       # ESLint

vercel deploy --prod --yes
vercel alias set methodshelper.vercel.app supsmasher.vercel.app  # run after every deploy
```

## File map

```
src/
  main.jsx                  — Entry; wraps App in BrowserRouter
  App.jsx                   — Route table + global overlays (mobile wordmark, bug report)
  lib/
    hooks.js                — useIsMobile() (breakpoint 768px)
    questions.js            — All Supabase queries + buildQuestionList()
    math.jsx                — <MathText> KaTeX component
    supabase.js             — Supabase client
  pages/
    TextbookSelect.jsx      — / — 2×2 grid of textbook cards
    TopicSelect.jsx         — /:subjectCode — topic list + Unit Plan panel
    Home.jsx                — /:subjectCode/:topicCode — session config
    Session.jsx             — /:subjectCode/:topicCode/session — study loop
  components/
    BugReportModal.jsx      — Issue report modal (submits to edge function)
    Sidebar.jsx             — UNUSED — kept but not rendered anywhere
vercel.json                 — Rewrites all paths to index.html (required for SPA routing)
STATUS.md                   — Shared state: done / todo / bugs
```

## Routing

React Router v7. Pages receive data via navigation state; fall back to Supabase fetch on direct URL/refresh. Session requires `location.state?.config` — shows error screen if missing.

```
/                                → TextbookSelect
/:subjectCode                    → TopicSelect
/:subjectCode/:topicCode         → Home
/:subjectCode/:topicCode/session → Session
```

## Design rules — do not break these

1. **Inline styles only.** Do not add CSS files, CSS modules, or Tailwind classes.
2. **`useIsMobile()` for responsive.** Import from `src/lib/hooks.js`. No media queries.
3. **Design tokens** (use exact values):
   - Backgrounds: `#0e0e0e`, `#131313`, `#171717`, `#1f2020`
   - Accent: `#c799ff`
   - Text: `#e7e5e5`, `#9f9d9d`, `#484848`, `#333`
   - Borders: `rgba(72,72,72,0.08)` – `rgba(72,72,72,0.15)`
4. **Don't touch data/query logic** in `lib/questions.js` unless explicitly asked.
5. **Don't restructure session phase logic** (`PHASE.QUESTION` → `PHASE.ANSWER`).
6. **Keyboard shortcuts must keep working:** Space/Enter = advance, ←→ = navigate, Esc = back.
7. **After any change: run `npm run build`** to verify no errors before deploying.

## Mobile layout notes

- Wordmark (SUPsmasher logo) is fixed top-left, **mobile only**, rendered in App.jsx.
- A 64px dark shield (`#0e0e0e`, `zIndex: 940`) sits behind it to mask scrolling content.
- Session page top padding on mobile is `72px` to clear the shield.
- Session mobile header: ▦ panel toggle (left) + topic/Ex/Q details right-aligned (right).
- TopicSelect right panel (Unit Plan, 320px) is hidden on mobile.
- QuestionPanel in Session is a slide-in drawer on mobile (toggled by ▦ button).

## Supabase

- **Project:** SUPsmasher (`bodwvpqtfhqmpzialpig.supabase.co`)
- **Anon key:** in `.env` as `VITE_SUPABASE_ANON_KEY` (also set in Vercel env vars)
- **Tables:** `subjects`, `sup_data`, `textbook_questions`
- **MM12 subject UUID:** `16c7e006-688c-4c2a-b086-1c9926cf2fd6`
- **Data status:** MM12 only — 1,117 questions, no answers yet. MM34/SM12/SM34 empty.

## Common gotchas

- `Sidebar.jsx` is imported nowhere — ignore it, don't delete unless cleaning up.
- `supsmasher.vercel.app` is a Vercel alias, not the project name. It must be re-set with `vercel alias set ...` after every production deploy.
- Question text from Supabase may contain mojibake (e.g. `â€"` instead of `—`). This is a data issue in the source import, not a rendering bug — don't try to fix it in code.
- Session config (skipEvery, startExerciseIndex, etc.) lives only in router state — not in the URL. Refreshing `/session` shows a "no session" screen by design.
