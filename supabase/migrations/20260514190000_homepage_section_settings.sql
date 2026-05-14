-- Homepage section visibility settings for What We Do, Customer Favourites, Testimonials
CREATE TABLE IF NOT EXISTS public.homepage_section_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  section_label TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.homepage_section_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_homepage_section_settings" ON public.homepage_section_settings;
CREATE POLICY "public_read_homepage_section_settings"
  ON public.homepage_section_settings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "staff_manage_homepage_section_settings" ON public.homepage_section_settings;
CREATE POLICY "staff_manage_homepage_section_settings"
  ON public.homepage_section_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default rows for the three controllable sections
INSERT INTO public.homepage_section_settings (section_key, section_label, is_visible)
VALUES
  ('what_we_do', '01 / What We Do', true),
  ('customer_favourites', '02 / Customer Favourites', true),
  ('testimonials', 'Testimonials', true)
ON CONFLICT (section_key) DO NOTHING;
