# GEMINI.md

This file provides foundational instructions and context for Gemini CLI when working in the `methodshelper` repository.

## Project Overview

**Methods Helper** is a specialized study tool for VCE Mathematical Methods students. It automates the process of practicing textbook questions by indexing PDFs and serving them through a modern, keyboard-driven web interface.

### Tech Stack
- **Frontend**: React (Vite, TypeScript/JSX), Vanilla CSS, KaTeX (Math rendering).
- **Backend**: Supabase (PostgreSQL for data, Storage for diagrams).
- **Automation**: Python scripts (PyMuPDF for PDF parsing, Ollama for local LLM/VLM indexing).
- **Design**: Minimalist, dark-themed UI using the **Space Grotesk** typeface.

---

## Core Architecture

### Data Model (Supabase)
- **`subjects`**: Metadata for textbooks (e.g., MM12, MM34).
- **`sup_data`**: Topic-to-exercise mappings extracted from "Supplementary" (SUP) documents.
- **`textbook_questions`**: The central repository of indexed questions.
  - `question_text`: The main "stem" of a question.
  - `parts` (JSONB): Structured sub-parts (a, b, c) containing their own text, answers, and diagram URLs.
  - `question_image` / `answer_image`: Global diagrams for the question number.

### Workflow
1.  **Indexing**: `scripts/index_textbook.py` uses a local VLM (Gemma 4 26B) to parse PDFs. It detects diagrams, crops them automatically using PyMuPDF, and uploads them to Supabase Storage.
2.  **Selection**: Users select a textbook and topic. The app fetches relevant questions from `textbook_questions` based on the `sup_data` for that topic.
3.  **Session**: A focused study loop where users navigate through sub-parts of a question using keyboard shortcuts.

---

## Key Commands

### Development (Frontend)
```bash
npm install        # Install dependencies
npm run dev        # Start development server (http://localhost:5173)
npm run build      # Build for production (output to dist/)
npm run lint       # Run ESLint checks
```

### Automation (Python)
*Requires `SUPABASE_SERVICE_KEY` and a local Ollama instance.*
```bash
# Index textbook exercises
python scripts/index_textbook.py --subject MM12 --pdf "path/to/textbook.pdf" --exercises 1A 1B

# Migrate SUP data from legacy project
python scripts/migrate_sups.py
```

---

## Development Conventions

### Styling & UI
- **Vanilla CSS**: Avoid Tailwind or heavy component libraries. Focus on custom CSS for interactive feedback and precise layouts.
- **Typography**: Use `Space Grotesk` (loaded via Google Fonts).
- **Math**: Always wrap math expressions in `$` (inline) or `$$` (block). The `<MathText>` component handles the parsing.

### Code Style
- **Surgical Updates**: When modifying pages or components, adhere strictly to the existing logic and state patterns.
- **Keyboard First**: Ensure all new session features are accessible via keyboard (Space, Enter, Arrows, Esc).
- **JSONB Integrity**: When updating the `parts` column in `textbook_questions`, maintain the established schema: `{ "a": { "text": "...", "answer": "...", "bbox": [...] } }`.

### Testing & Validation
- **Empirical Verification**: Before submitting a change to the indexing script, verify the LLM prompt's output format with a sample page.
- **Visual Check**: Always verify LaTeX rendering in the `Session` page after data schema changes.
