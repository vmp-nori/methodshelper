# Methods Helper — Setup Guide

## 1. Run the database schema

Open your Supabase project → SQL Editor → paste and run `schema.sql`.

## 2. Set up the indexing scripts (run once, on your Windows machine)

```
cd scripts
pip install -r requirements.txt
```

You need two keys from your Supabase dashboard (Settings → API):
- **Service role key** (not the anon key — this one has write access)

And your OpenAI API key.

### Step A: Parse SUP files

This downloads the .docx SUPs from Supabase Storage and populates the `sup_data` table.

```
set SUPABASE_SERVICE_KEY=your_service_role_key_here
python parse_sups.py
```

This takes about 30 seconds and costs nothing (no AI calls needed).

### Step B: Index the textbook

This reads `Methods 1&2.pdf`, sends pages to GPT-4o, and populates `textbook_questions`.

```
set SUPABASE_SERVICE_KEY=your_service_role_key_here
set OPENAI_API_KEY=your_openai_key_here
python index_textbook.py
```

**Cost estimate:** ~$3–8 USD for the full textbook (~500 pages at $0.01–0.015/page).

You can index just specific exercises first to test:
```
python index_textbook.py --exercises 1A 1B 1C
```

The script is safe to re-run — it skips questions already indexed.

## 3. Run the webapp

```
# In the project root:
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## 4. Keyboard controls

| Key | Action |
|-----|--------|
| Space | Reveal answer / next question |
| → | Next question (after answer is shown) |
| ← | Previous question |
| Esc | Back to home screen |
