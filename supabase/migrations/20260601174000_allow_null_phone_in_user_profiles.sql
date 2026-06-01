-- Allow phone to be NULL in user_profiles
-- Fixes: "null value in column phone of relation user_profiles violates not-null constraint"
-- when editing a staff member's role without providing a phone number.

ALTER TABLE public.user_profiles
  ALTER COLUMN phone DROP NOT NULL;

-- Ensure any existing empty-string phone values are converted to NULL for consistency
UPDATE public.user_profiles
SET phone = NULL
WHERE phone = '';
