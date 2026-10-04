-- Migration: Add WhatsApp number to registrations, session_name to event dates, and per-event/class image support

-- 1. WhatsApp number on cooking_class_registrations
ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT '';

-- 2. WhatsApp number on event_management_registrations
ALTER TABLE public.event_management_registrations
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT '';

-- 3. Session name on cooking_class_event_dates
ALTER TABLE public.cooking_class_event_dates
  ADD COLUMN IF NOT EXISTS session_name TEXT DEFAULT '';

-- 4. Session name on event_management_event_dates
ALTER TABLE public.event_management_event_dates
  ADD COLUMN IF NOT EXISTS session_name TEXT DEFAULT '';

-- 5. Per-event image on cooking_class_events
ALTER TABLE public.cooking_class_events
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_path TEXT;

-- 6. Per-event image on event_management_events
ALTER TABLE public.event_management_events
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_path TEXT;
