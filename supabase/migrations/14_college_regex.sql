-- Migration: 14_college_regex
-- Adds regex pattern and human-readable format hints to universities and colleges.

-- Add format hint and blocks to universities
ALTER TABLE public.universities 
  ADD COLUMN IF NOT EXISTS roll_number_format_hint TEXT,
  ADD COLUMN IF NOT EXISTS roll_number_regex_blocks JSONB;

-- Add regex, format hint, and blocks to colleges
ALTER TABLE public.colleges 
  ADD COLUMN IF NOT EXISTS roll_number_regex TEXT,
  ADD COLUMN IF NOT EXISTS roll_number_format_hint TEXT,
  ADD COLUMN IF NOT EXISTS roll_number_regex_blocks JSONB;
