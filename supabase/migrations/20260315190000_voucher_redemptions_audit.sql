-- Voucher Redemptions Audit Trail Enhancement
-- Adds detailed audit columns to voucher_redemptions for full traceability

-- Add customer detail columns and audit fields to voucher_redemptions
ALTER TABLE public.voucher_redemptions
ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS meals_remaining_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS meals_remaining_after INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_ordered JSONB DEFAULT '[]'::jsonb;

-- Index for faster lookups by order_id
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_order_id ON public.voucher_redemptions(order_id);
