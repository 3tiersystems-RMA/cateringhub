-- Migration: Add 'collected' to fulfillment_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'collected'
    AND enumtypid = 'public.fulfillment_status'::regtype
  ) THEN
    ALTER TYPE public.fulfillment_status ADD VALUE 'collected';
  END IF;
END $$;
