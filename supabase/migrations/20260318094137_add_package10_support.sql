-- Add package-10 support to vouchers and products tables
-- Extends CHECK constraints to include 'package-10' for the 10-Package Meal option

-- 1. Update vouchers.package_type CHECK constraint to include package-10
ALTER TABLE public.vouchers
  DROP CONSTRAINT IF EXISTS vouchers_package_type_check;

ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_package_type_check
  CHECK (package_type IN ('none', 'package-6', 'package-10', 'package-12', 'package-24'));

-- 2. Backfill any existing vouchers with total_meals = 10 that were stored as 'none'
UPDATE public.vouchers
SET package_type = 'package-10'
WHERE total_meals = 10 AND package_type = 'none';

-- 3. Update products.package_type CHECK constraint to include package-10
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_package_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_package_type_check
  CHECK (package_type IN ('none', 'package-6', 'package-10', 'package-12', 'package-24'));
