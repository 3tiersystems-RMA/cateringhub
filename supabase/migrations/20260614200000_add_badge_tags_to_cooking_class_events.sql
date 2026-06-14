-- Add badge and tags columns to cooking_class_events
ALTER TABLE public.cooking_class_events
  ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'Cooking Class',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];
