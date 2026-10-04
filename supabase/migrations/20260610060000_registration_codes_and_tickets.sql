-- Add registration_code to cooking_class_registrations
ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS registration_code text;

-- Add registration_code to event_management_registrations
ALTER TABLE public.event_management_registrations
  ADD COLUMN IF NOT EXISTS registration_code text;

-- Backfill existing rows with generated codes (CC- prefix for cooking class, EB- for events)
UPDATE public.cooking_class_registrations
  SET registration_code = 'CC-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE registration_code IS NULL;

UPDATE public.event_management_registrations
  SET registration_code = 'EB-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE registration_code IS NULL;
