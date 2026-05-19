-- Add banking_details column to correspondence_settings
ALTER TABLE public.correspondence_settings
  ADD COLUMN IF NOT EXISTS banking_details TEXT;
