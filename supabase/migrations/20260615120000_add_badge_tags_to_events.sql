-- Badge and tags for marketing events (public.events table).
-- In-person classes use cooking_classes.badge / cooking_classes.tags separately.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN public.events.badge IS
  'Public card badge for bookable marketing events (e.g. Registered Event).';

COMMENT ON COLUMN public.events.tags IS
  'Tag pills shown on the public event card (e.g. Kids Only, Adults Only).';

-- Default badge for existing registered events
UPDATE public.events
SET badge = 'Registered Event'
WHERE is_registered = true
  AND (badge IS NULL OR TRIM(badge) = '');
