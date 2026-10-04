-- Add online_form_status to cooking_class_settings
-- Controls whether the public booking form is active or inactive

ALTER TABLE public.cooking_class_settings
  ADD COLUMN IF NOT EXISTS online_form_status TEXT NOT NULL DEFAULT 'active';
