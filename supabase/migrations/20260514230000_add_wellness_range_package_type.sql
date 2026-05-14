-- Add 'wellness-range' to the package_type CHECK constraint on products table

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_package_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_package_type_check
  CHECK (package_type IN ('none', 'package-6', 'package-12', 'package-24', 'wellness-range'));
