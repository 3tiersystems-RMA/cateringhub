-- Add event_id to cooking_class_event_dates to link sessions to specific events
ALTER TABLE public.cooking_class_event_dates
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.cooking_class_events(id) ON DELETE SET NULL;

-- Add class_fee to cooking_class_event_dates so each session can have its own fee
ALTER TABLE public.cooking_class_event_dates
ADD COLUMN IF NOT EXISTS class_fee NUMERIC(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cooking_class_event_dates_event_id ON public.cooking_class_event_dates(event_id);
