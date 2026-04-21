# STATUS.md

Shared project state for AI agents. Update this file whenever you complete a task, discover a bug, or change the backlog. Read this before starting any task.

Last updated: 2026-04-16

---

## What's been built

### Core app
- [x] Textbook selection page (2×2 card grid, MM12 active, others disabled)
- [x] Topic selection page (list + Unit Plan right panel)
- [x] Session config page (start exercise dropdown + question filter + start button)
- [x] Study session loop (question → answer reveal → next, with sub-part handling)
- [x] KaTeX math rendering via `<MathText>` component
- [x] Keyboard navigation: Space/Enter = advance, ←→ = navigate, Esc = back
- [x] Gemini AI "Ask Gemini" button with step-by-step working UI
- [x] Settings page for Gemini API key + model selection

### Data
- [x] MM12: 1,117 questions across 128 exercises (1A–10F) imported into Supabase
- [x] MM34: Enabled and ready for import via `scripts/import_questions.py`
- [x] SUP data (topic → exercise mappings) migrated from nori.study for MM12
- [x] Image support removed from frontend and import scripts by design
- [x] MM12 answers — 1,053 questions extracted into methods12answers.json
  - **Chapters complete (100%):** 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 16, 17, 18, 20, 21
  - **Overall coverage:** ~94% (1,053 of ~1,117 questions)
- [x] LaTeX rendering fixed (all validation passed)
- [x] MM34: ~1,100 questions indexed and answers extracted
  - **Coverage:** ~90% (Some diagram/range questions skipped during stem indexing)
- [x] SM12: ~1,000 questions indexed and answers extracted
  - **Coverage:** ~85% (Some sections skipped due to source image/stem availability)
- [ ] SM34 — no questions indexed yet

### Infrastructure
- [x] Gemini Assistant — integrated Google Gemini Pro/Flash for step-by-step working via "Ask Gemini" button
- [x] Settings page — users store Gemini API key + select model (stored in `localStorage`, not transmitted to backend)
- [x] GeminiChat component — parses AI response into step cards with final answer highlighted
- [x] Hosted on Vercel: https://supsmasher.vercel.app (alias) / https://methodshelper.vercel.app (canonical)
- [x] Vercel env vars set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [x] `vercel.json` SPA rewrite (all paths → index.html)
- [x] React Router v7 — URL updates with navigation, browser back/forward works
- [x] Deep links and page refresh work (pages fetch data from Supabase using URL params)
- [x] Answer merge script: `scripts/import_answers.py` (safely merges JSON answers into DB)

### UI/UX
- [x] Bug report modal (floating ⚑ button, 6 issue types, submits via Supabase Edge Function)
- [x] Mobile responsive layout (`useIsMobile` hook, inline style conditionals)
- [x] Mobile: single-column card grid, reduced padding, hidden Unit Plan panel
- [x] Mobile: QuestionPanel as slide-in drawer (▦ toggle), not sidebar
- [x] Mobile: wordmark fixed top-left with dark shield to prevent scroll bleed-through
- [x] Mobile: session header — question details right-aligned, panel toggle left
- [x] Desktop: session left sidebar removed (was unused icon nav)
- [x] Session header: topic name as small purple label + large "Ex X · QN" text
- [x] Timer removed from session view

---

## Backlog (to be done)

### High priority
- [x] ~~**Import MM12 answers**~~ — Completed. 554 questions imported via `scripts/import_answers.py` (chapters 1–6, 9–11).
- [ ] **Fill remaining gaps in chapters 2–6** — 4–5 missing questions per chapter (range questions excluded by design).
- [x] ~~**Extract chapters 7, 13–21 answers**~~ — Completed (1,053 answers total).
- [ ] **Import extracted answers into Supabase** — Use `scripts/import_answers.py` to upload `methods12answers.json`.
- [ ] **Test Gemini AI working-out feature** — Users with API key in Settings should see step-by-step solutions in Session.
- [ ] **Deploy `send-bug-report` Supabase Edge Function** — `BugReportModal` calls `supabase.functions.invoke('send-bug-report')` but this function may not be deployed yet. Bug reports will silently fail until it is.
- [ ] **Vercel alias automation** — currently `vercel alias set methodshelper.vercel.app supsmasher.vercel.app` must be re-run manually after every deploy. Set up Vercel Git integration or a proper custom domain to avoid this.

### Medium priority
- [x] Index MM34 textbook — `scripts/import_questions.py` created and card enabled.
- [ ] Index SM12 / SM34 textbooks — same process.
- [ ] Migrate SUP data for MM34/SM34 — run `migrate_sups.py` (currently only MM12, SM12 data in `sup_data`).
- [ ] **Custom domain** — `supsmasher.com` is available for ~$11.25/yr via Vercel. Would replace the manual alias approach.
- [ ] **Connect GitHub repo to Vercel** — currently requires manual `vercel deploy`. Blocked by GitHub login connection in Vercel account settings.

### Low priority
- [x] **Answer extraction** — Script `import_answers.py` created to merge LLM-generated JSON.
- [ ] **Progress tracking** — no user accounts; sessions are stateless. Could add local-storage-based progress if needed.
- [ ] **Touch gestures in Session** — swipe left/right could replace ←→ arrow keys on mobile. Currently mobile users tap the screen to advance (works via `onClick={advance}` on the outer div).

---

## Known bugs / issues

| # | Severity | Description | Cause | Fix |
|---|----------|-------------|-------|-----|
| 1 | Medium | Question text shows mojibake: `positionâ€"time` instead of `position–time` | Em dashes (and possibly other special chars) were double-encoded during PDF import | Re-import affected questions with corrected encoding in `import_questions.py` |
| 2 | Low | `supsmasher.vercel.app` alias breaks after each new deployment | Vercel aliases point to a specific deployment URL, not the project | Re-run `vercel alias set methodshelper.vercel.app supsmasher.vercel.app` after every deploy, or set up proper custom domain |
| 3 | Low | `Sidebar.jsx` is an unused file | Left sidebar was removed from Session but file was kept | Safe to delete `src/components/Sidebar.jsx` if cleaning up |
| 4 | Low | Refreshing `/session` shows "No session in progress" | Session config lives in router state only — can't survive a page refresh | By design; user must re-configure session. Could be improved with sessionStorage if needed. |

---

## Architecture snapshot (as of 2026-04-13)

```
supsmasher.vercel.app
    ↓
Vercel (SPA rewrite → index.html)
    ↓
React app (React Router v7)
    /                  → TextbookSelect
    /:subject          → TopicSelect
    /:subject/:topic   → Home (session config)
    /:subject/:topic/session → Session (study loop)
    ↓
Supabase JS client → SUPsmasher project (bodwvpqtfhqmpzialpig.supabase.co)
    tables: subjects, sup_data, textbook_questions
    edge functions: send-bug-report (deployment status unknown)
```

---

## How to update this file

- When you finish a task: tick off the relevant backlog item(s), add to "What's been built" if significant.
- When you find a bug: add a row to the bugs table.
- When you fix a bug: mark it ~~struck through~~ or remove it.
- Keep "Last updated" current.
- Do not remove history — strike through completed backlog items rather than deleting them.
