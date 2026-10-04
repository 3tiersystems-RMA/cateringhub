-- Add 'type' column to cooking_class_registrations
-- Allows distinguishing registration types (e.g. 'class' vs future types)
-- All existing and new records default to 'class'

ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'class';

-- Backfill any existing rows
UPDATE public.cooking_class_registrations
  SET type = 'class'
  WHERE type IS NULL OR type = '';

CREATE INDEX IF NOT EXISTS idx_cooking_class_registrations_type
  ON public.cooking_class_registrations(type);
