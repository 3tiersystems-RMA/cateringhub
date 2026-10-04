-- Migration: Add 'unpaid' to payment_status enum
-- Allows orders to be explicitly marked as 'unpaid', which is the only status
-- that triggers the Send Payment Reminder action for staff.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'unpaid'
    AND enumtypid = 'public.payment_status'::regtype
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'unpaid';
  END IF;
END $$;
