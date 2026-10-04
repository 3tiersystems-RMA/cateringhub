-- Add lead_time column to products table
-- lead_time stores the calculated difference (in days) between delivered_date and created_at on an order
-- This is a computed/stored field that can be populated from order data

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS lead_time INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.products.lead_time IS 'Lead time in days: difference between delivered_date and order created_at. Calculated from order data.';
