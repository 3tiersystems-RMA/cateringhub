-- Social Links table for footer social media URLs
CREATE TABLE IF NOT EXISTS public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL DEFAULT '#',
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_links_platform ON public.social_links(platform);

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

-- Public can read social links
DROP POLICY IF EXISTS "public_read_social_links" ON public.social_links;
CREATE POLICY "public_read_social_links"
ON public.social_links
FOR SELECT
TO public
USING (true);

-- Only authenticated staff can update
DROP POLICY IF EXISTS "staff_update_social_links" ON public.social_links;
CREATE POLICY "staff_update_social_links"
ON public.social_links
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Seed default social links
INSERT INTO public.social_links (platform, url, display_order) VALUES
  ('facebook', '#', 1),
  ('twitter', '#', 2),
  ('instagram', '#', 3),
  ('pinterest', '#', 4),
  ('custom', '#', 5)
ON CONFLICT (platform) DO NOTHING;
