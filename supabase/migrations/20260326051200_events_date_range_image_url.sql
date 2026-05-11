-- Add event_date_to (optional end date) and image_url (URL-based image) to events table

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_date_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_url TEXT;
