-- Voucher Unpaid Status Migration
-- Adds 'unpaid' and 'paid' statuses to voucher_status enum
-- Vouchers are created as 'unpaid' and only become 'paid' after payment is confirmed

-- 1. Add new enum values to voucher_status
-- PostgreSQL requires ALTER TYPE to add values (cannot use DROP/CREATE CASCADE as it would break existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'unpaid'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'voucher_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.voucher_status ADD VALUE 'unpaid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'paid'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'voucher_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.voucher_status ADD VALUE 'paid';
  END IF;
END $$;

-- 2. Add payment_reference column to track PayFast payment ID for voucher purchases
ALTER TABLE public.vouchers
ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT '';

-- 3. Allow anonymous users to update their own voucher (needed for payment confirmation via service role)
-- The actual status update to 'paid' is done server-side via service role in the ITN callback
-- No additional anon update policy needed — service role handles it

-- 4. Update default status for new vouchers to 'unpaid'
-- (Application code will insert with status='unpaid' going forward)
