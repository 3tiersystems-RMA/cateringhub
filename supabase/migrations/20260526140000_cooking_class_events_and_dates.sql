-- Cooking Class Events (e.g. Kids Event, Adults Event, Leadership Workshop)
CREATE TABLE IF NOT EXISTS public.cooking_class_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Cooking Class Event Details (date rows per event session)
CREATE TABLE IF NOT EXISTS public.cooking_class_event_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE,
  start_time TEXT,
  end_time TEXT,
  location TEXT DEFAULT '12 Cardamom Street, Cape Town, 7441',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.cooking_class_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_class_event_dates ENABLE ROW LEVEL SECURITY;

-- Events: public can read, authenticated staff can manage
DROP POLICY IF EXISTS "public_read_cooking_class_events" ON public.cooking_class_events;
CREATE POLICY "public_read_cooking_class_events"
ON public.cooking_class_events FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_cooking_class_events" ON public.cooking_class_events;
CREATE POLICY "authenticated_manage_cooking_class_events"
ON public.cooking_class_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Event dates: public can read, authenticated staff can manage
DROP POLICY IF EXISTS "public_read_cooking_class_event_dates" ON public.cooking_class_event_dates;
CREATE POLICY "public_read_cooking_class_event_dates"
ON public.cooking_class_event_dates FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_cooking_class_event_dates" ON public.cooking_class_event_dates;
CREATE POLICY "authenticated_manage_cooking_class_event_dates"
ON public.cooking_class_event_dates FOR ALL TO authenticated USING (true) WITH CHECK (true);
