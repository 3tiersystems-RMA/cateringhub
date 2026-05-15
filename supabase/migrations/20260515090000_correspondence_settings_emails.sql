-- Add info_email and admin_email columns to correspondence_settings
ALTER TABLE public.correspondence_settings
  ADD COLUMN IF NOT EXISTS info_email TEXT,
  ADD COLUMN IF NOT EXISTS admin_email TEXT;
