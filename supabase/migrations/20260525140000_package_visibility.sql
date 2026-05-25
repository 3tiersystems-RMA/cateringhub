-- Package Visibility table
-- Stores visibility flags for each voucher meal package
-- Staff can toggle packages on/off; only visible packages appear on the Meal Vouchers page

CREATE TABLE IF NOT EXISTS public.package_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL UNIQUE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_package_visibility_package_name ON public.package_visibility(package_name);

ALTER TABLE public.package_visibility ENABLE ROW LEVEL SECURITY;

-- Public can read (needed for the customer-facing Voucher Meals page)
DROP POLICY IF EXISTS "public_read_package_visibility" ON public.package_visibility;
CREATE POLICY "public_read_package_visibility"
  ON public.package_visibility
  FOR SELECT
  TO public
  USING (true);

-- Authenticated staff can update visibility
DROP POLICY IF EXISTS "staff_manage_package_visibility" ON public.package_visibility;
CREATE POLICY "staff_manage_package_visibility"
  ON public.package_visibility
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed initial rows for all known packages (idempotent)
INSERT INTO public.package_visibility (package_name, is_visible) VALUES
  ('package-6',        true),
  ('package-10',       true),
  ('package-12',       true),
  ('package-24',       true),
  ('wellness-range',   true),
  ('month-end-special', true)
ON CONFLICT (package_name) DO NOTHING;
