-- Add package_type column to products table
-- Values: none (default), package-6, package-12, package-24

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'none'
  CHECK (package_type IN ('none', 'package-6', 'package-12', 'package-24'));

-- Index for fast filtering by package_type
CREATE INDEX IF NOT EXISTS idx_products_package_type ON public.products(package_type);
