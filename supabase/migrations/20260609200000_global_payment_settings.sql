-- Global Settings: payment visibility toggles
CREATE TABLE IF NOT EXISTS public.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_label TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_global_settings_key ON public.global_settings(setting_key);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Public read (so payment pages can check visibility without auth)
DROP POLICY IF EXISTS "global_settings_public_read" ON public.global_settings;
CREATE POLICY "global_settings_public_read"
  ON public.global_settings
  FOR SELECT
  TO public
  USING (true);

-- Authenticated staff can update
DROP POLICY IF EXISTS "global_settings_staff_update" ON public.global_settings;
CREATE POLICY "global_settings_staff_update"
  ON public.global_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default rows (idempotent)
INSERT INTO public.global_settings (setting_key, setting_label, is_enabled)
VALUES
  ('payfast_payment', 'PayFast Payment', true),
  ('eft_payment', 'EFT Payment', true)
ON CONFLICT (setting_key) DO NOTHING;
