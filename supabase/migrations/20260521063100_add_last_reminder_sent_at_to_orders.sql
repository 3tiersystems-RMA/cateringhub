-- Add last_reminder_sent_at column to orders table
-- Records the last date a manual payment reminder was sent for each order

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_last_reminder_sent_at ON public.orders(last_reminder_sent_at);
