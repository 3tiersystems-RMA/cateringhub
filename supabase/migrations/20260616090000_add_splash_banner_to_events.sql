-- Add splash_banner_text column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS splash_banner_text TEXT DEFAULT NULL;
