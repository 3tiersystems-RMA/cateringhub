-- Add menu_items and menu_note columns to cooking_class_events
-- These fields power the Notes card in CookingClassSettings and the public class card display

ALTER TABLE public.cooking_class_events
  ADD COLUMN IF NOT EXISTS menu_items TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS menu_note TEXT DEFAULT NULL;
