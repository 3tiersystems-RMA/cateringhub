-- Migration: Extend order status enums
-- Adds 'cancelled' to fulfillment_status and 'awaiting_payment'/'refunded' to payment_status

-- Add new values to payment_status enum (ALTER TYPE ADD VALUE is idempotent-safe with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'awaiting_payment'
    AND enumtypid = 'public.payment_status'::regtype
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'awaiting_payment';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'refunded'
    AND enumtypid = 'public.payment_status'::regtype
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'refunded';
  END IF;
END $$;

-- Add 'cancelled' to fulfillment_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
    AND enumtypid = 'public.fulfillment_status'::regtype
  ) THEN
    ALTER TYPE public.fulfillment_status ADD VALUE 'cancelled';
  END IF;
END $$;
