-- Add 'discounted' to the payment_status enum
-- PostgreSQL does not support IF NOT EXISTS for ALTER TYPE ADD VALUE,
-- so we check pg_enum first to make it idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'discounted'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'payment_status'
      )
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'discounted';
  END IF;
END $$;
