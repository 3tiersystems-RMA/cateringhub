-- Migration: Update all existing 'active' voucher statuses to 'unpaid'
-- This ensures consistency: vouchers are either 'unpaid' (awaiting payment) or 'paid' (verified)

UPDATE public.vouchers
SET status = 'unpaid'
WHERE status = 'active';
