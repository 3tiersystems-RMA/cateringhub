-- Voucher Scanner: Add redeemed_by column to voucher_redemptions
-- Tracks which staff member scanned/redeemed each meal unit

ALTER TABLE public.voucher_redemptions
ADD COLUMN IF NOT EXISTS redeemed_by TEXT DEFAULT '';

-- Index for faster lookups by redeemed_by
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_redeemed_by ON public.voucher_redemptions(redeemed_by);
