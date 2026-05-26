-- Add seating capacity and status to cooking_class_event_dates
ALTER TABLE public.cooking_class_event_dates
ADD COLUMN IF NOT EXISTS seating INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_id UUID;

-- Session statuses lookup table (dynamic, staff-managed)
CREATE TABLE IF NOT EXISTS public.cooking_class_session_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.cooking_class_session_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_session_statuses" ON public.cooking_class_session_statuses;
CREATE POLICY "public_read_session_statuses"
ON public.cooking_class_session_statuses FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_session_statuses" ON public.cooking_class_session_statuses;
CREATE POLICY "authenticated_manage_session_statuses"
ON public.cooking_class_session_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add foreign key for status_id after table is created
ALTER TABLE public.cooking_class_event_dates
ADD CONSTRAINT fk_event_date_status
FOREIGN KEY (status_id) REFERENCES public.cooking_class_session_statuses(id) ON DELETE SET NULL;

-- Booking counts per session (tracks how many people booked each session date)
CREATE TABLE IF NOT EXISTS public.cooking_class_booking_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date_id UUID NOT NULL REFERENCES public.cooking_class_event_dates(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.cooking_class_registrations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_date_id, registration_id)
);

ALTER TABLE public.cooking_class_booking_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_booking_counts" ON public.cooking_class_booking_counts;
CREATE POLICY "public_insert_booking_counts"
ON public.cooking_class_booking_counts FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_booking_counts" ON public.cooking_class_booking_counts;
CREATE POLICY "public_read_booking_counts"
ON public.cooking_class_booking_counts FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_booking_counts" ON public.cooking_class_booking_counts;
CREATE POLICY "authenticated_manage_booking_counts"
ON public.cooking_class_booking_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default status options
INSERT INTO public.cooking_class_session_statuses (label, sort_order) VALUES
  ('Active', 0),
  ('Fully Booked', 1),
  ('Cancelled', 2),
  ('Venue Change', 3)
ON CONFLICT (label) DO NOTHING;
