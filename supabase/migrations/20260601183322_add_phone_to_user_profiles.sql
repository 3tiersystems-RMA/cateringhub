-- Add phone column to user_profiles table
-- Uses IF NOT EXISTS so this is safe to run even if the column already exists

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;
