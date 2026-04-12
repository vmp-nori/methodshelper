-- Run this in your Supabase SQL editor to set up the methods helper tables

-- Stores parsed SUP data: for each topic, which exercises and question numbers are assigned
CREATE TABLE IF NOT EXISTS public.sup_data (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES public.subjects(id),
  topic_code  TEXT NOT NULL,   -- e.g. "T01"
  topic_name  TEXT,            -- e.g. "Coordinate Geometry"
  exercises   JSONB NOT NULL,  -- [{"exercise":"1A","questions":[1,3,5,7,9]}, ...]
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subject_id, topic_code)
);

-- Stores indexed textbook questions and their answers
CREATE TABLE IF NOT EXISTS public.textbook_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      UUID NOT NULL REFERENCES public.subjects(id),
  exercise        TEXT NOT NULL,    -- e.g. "1A"
  question_number INTEGER NOT NULL, -- e.g. 3
  question_text   TEXT,             -- extracted question text/stem
  question_image  TEXT,             -- URL/data for question diagram
  answer_text     TEXT,             -- flat answer text (if no parts)
  answer_image    TEXT,             -- URL/data for answer diagram
  parts           JSONB,            -- structured sub-parts: { "a": { "text": "...", "answer": "...", "image": "..." }, ... }
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subject_id, exercise, question_number)
);

-- Index for fast lookups by exercise
CREATE INDEX IF NOT EXISTS idx_textbook_questions_subject_exercise
  ON public.textbook_questions (subject_id, exercise);
