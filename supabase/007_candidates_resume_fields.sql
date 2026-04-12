-- Migration 007: Add resume and profile fields to candidates

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_url         text,
  ADD COLUMN IF NOT EXISTS current_company    text,
  ADD COLUMN IF NOT EXISTS "current_role"     text,
  ADD COLUMN IF NOT EXISTS years_of_experience integer,
  ADD COLUMN IF NOT EXISTS skills             text[],
  ADD COLUMN IF NOT EXISTS education          text,
  ADD COLUMN IF NOT EXISTS resume_parsed      boolean DEFAULT false;
