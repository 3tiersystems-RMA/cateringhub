-- Add new fields to cooking_class_registrations table
-- These fields were added to the registration form but were missing from the DB schema

ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS relationship TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS first_time_portal TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS allergies_illness TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS rsa_id_passport TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact1 JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_contact2 JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS children JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attend_school_holiday TEXT DEFAULT '';
