-- Correspondence Settings table for configuring fields used across email forms
CREATE TABLE IF NOT EXISTS public.correspondence_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_header_title TEXT NOT NULL DEFAULT 'Cardamom Catering',
  logo_url TEXT,
  terms_and_conditions TEXT,
  sales_representative TEXT,
  office_number TEXT,
  comments TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed a single default row if none exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.correspondence_settings LIMIT 1) THEN
    INSERT INTO public.correspondence_settings (id, form_header_title)
    VALUES (gen_random_uuid(), 'Cardamom Catering');
  END IF;
END $$;

ALTER TABLE public.correspondence_settings ENABLE ROW LEVEL SECURITY;

-- Staff (authenticated) can read
DROP POLICY IF EXISTS "staff_read_correspondence_settings" ON public.correspondence_settings;
CREATE POLICY "staff_read_correspondence_settings"
  ON public.correspondence_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff (authenticated) can update
DROP POLICY IF EXISTS "staff_update_correspondence_settings" ON public.correspondence_settings;
CREATE POLICY "staff_update_correspondence_settings"
  ON public.correspondence_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
