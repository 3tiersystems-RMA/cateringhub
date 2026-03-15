-- Add package_type column to vouchers table
-- Links a voucher to a specific package tier: none, package-6, package-12, package-24

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'none'
  CHECK (package_type IN ('none', 'package-6', 'package-12', 'package-24'));

-- Backfill existing vouchers based on total_meals
UPDATE public.vouchers
SET package_type = CASE
  WHEN total_meals = 6  THEN 'package-6'
  WHEN total_meals = 12 THEN 'package-12'
  WHEN total_meals = 24 THEN 'package-24'
  ELSE 'none'
END
WHERE package_type = 'none';

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_vouchers_package_type ON public.vouchers(package_type);
