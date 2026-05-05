-- Add registered event fields to events table
-- is_registered: marks event as a Registered Event (requires enrollment)
-- cost: price for the event (e.g. 150.00)
-- enrollment_url: external URL for enrollment/registration
-- event_menu: text/list of what will be covered in the event (e.g. baking items)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS enrollment_url TEXT,
  ADD COLUMN IF NOT EXISTS event_menu TEXT;
