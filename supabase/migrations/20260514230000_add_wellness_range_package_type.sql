-- Add 'wellness-range' to the package_type CHECK constraint on products table

-- Drop all possible constraint names (inline column constraint or named constraint)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_package_type_check;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_package_type_check1;

-- Also drop the constraint that may have been created inline with the column definition
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%package_type%'
  LOOP
    EXECUTE 'ALTER TABLE public.products DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END;
$$;

-- Add the updated constraint with all valid values including wellness-range
ALTER TABLE public.products
  ADD CONSTRAINT products_package_type_check
  CHECK (package_type IN ('none', 'package-6', 'package-12', 'package-24', 'wellness-range'));
