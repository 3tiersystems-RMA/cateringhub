-- Add delivered_date column to orders table
-- This column is set automatically when fulfillment_status changes to 'delivered'

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivered_date TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_date ON public.orders(delivered_date);
