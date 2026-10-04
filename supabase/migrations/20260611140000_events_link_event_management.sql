-- Link public marketing events to Event Bookings → Settings (bookable event + session)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_management_event_id uuid
    REFERENCES public.event_management_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_management_session_id uuid
    REFERENCES public.event_management_event_dates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_event_management_event_id
  ON public.events(event_management_event_id);

CREATE INDEX IF NOT EXISTS idx_events_event_management_session_id
  ON public.events(event_management_session_id);
