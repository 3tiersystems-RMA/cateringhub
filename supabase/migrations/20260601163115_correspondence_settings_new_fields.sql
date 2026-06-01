-- Add new fields to correspondence_settings table
ALTER TABLE public.correspondence_settings
ADD COLUMN IF NOT EXISTS default_despatch_address TEXT,
ADD COLUMN IF NOT EXISTS cost_per_km NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS default_delivery_charge NUMERIC(10, 2);
