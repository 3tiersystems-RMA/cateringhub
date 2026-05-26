-- Cooking & Baking Class settings table
-- Stores flyer image, Google Sheet config, and class registration submissions

CREATE TABLE IF NOT EXISTS public.cooking_class_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_image_url TEXT,
  flyer_image_path TEXT,
  sheet_id TEXT,
  sheet_name TEXT,
  class_fee NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.cooking_class_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL,
  cellphone TEXT NOT NULL,
  selected_events TEXT[] NOT NULL DEFAULT '{}',
  adult_class_dates TEXT[] NOT NULL DEFAULT '{}',
  payment_method TEXT NOT NULL DEFAULT 'payfast',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  proof_of_payment_url TEXT,
  proof_of_payment_path TEXT,
  payfast_payment_id TEXT,
  amount NUMERIC(10,2),
  synced_to_sheet BOOLEAN DEFAULT FALSE,
  sheet_row_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cooking_class_registrations_email ON public.cooking_class_registrations(email);
CREATE INDEX IF NOT EXISTS idx_cooking_class_registrations_payment_status ON public.cooking_class_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_cooking_class_registrations_created_at ON public.cooking_class_registrations(created_at);

ALTER TABLE public.cooking_class_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_class_registrations ENABLE ROW LEVEL SECURITY;

-- Settings: staff can read/write, public can read
DROP POLICY IF EXISTS "public_read_cooking_class_settings" ON public.cooking_class_settings;
CREATE POLICY "public_read_cooking_class_settings"
ON public.cooking_class_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_cooking_class_settings" ON public.cooking_class_settings;
CREATE POLICY "authenticated_manage_cooking_class_settings"
ON public.cooking_class_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Registrations: public can insert, authenticated can read/manage
DROP POLICY IF EXISTS "public_insert_cooking_class_registrations" ON public.cooking_class_registrations;
CREATE POLICY "public_insert_cooking_class_registrations"
ON public.cooking_class_registrations FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_cooking_class_registrations" ON public.cooking_class_registrations;
CREATE POLICY "authenticated_manage_cooking_class_registrations"
ON public.cooking_class_registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default settings row
INSERT INTO public.cooking_class_settings (id, flyer_image_url, sheet_id, sheet_name, class_fee)
VALUES (gen_random_uuid(), NULL, NULL, 'Registrations', 0)
ON CONFLICT DO NOTHING;
