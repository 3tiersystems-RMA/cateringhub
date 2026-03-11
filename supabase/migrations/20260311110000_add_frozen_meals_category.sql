-- Add 'Frozen Meals' to product_category enum
-- ALTER TYPE ADD VALUE is safe and does not require DROP/RECREATE

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Frozen Meals'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'product_category'
      )
  ) THEN
    ALTER TYPE public.product_category ADD VALUE 'Frozen Meals';
  END IF;
END $$;
