-- Add skill_level column to cooking_class_registrations
-- Stores the participant's self-reported cooking skill level
-- Valid values: Novice, Beginner, Intermediate, Advanced
-- Note: skill_level is also stored per-participant inside the children JSONB array

ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS skill_level TEXT DEFAULT '';
