-- Testimonials table for homepage display
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_testimonials_is_active ON public.testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_testimonials_display_order ON public.testimonials(display_order);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Public can read active testimonials
DROP POLICY IF EXISTS "public_read_testimonials" ON public.testimonials;
CREATE POLICY "public_read_testimonials"
  ON public.testimonials
  FOR SELECT
  TO public
  USING (is_active = true);

-- Authenticated staff can manage all testimonials
DROP POLICY IF EXISTS "staff_manage_testimonials" ON public.testimonials;
CREATE POLICY "staff_manage_testimonials"
  ON public.testimonials
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed with the existing hard-coded testimonials
INSERT INTO public.testimonials (quote, name, role, avatar_url, rating, is_active, display_order)
VALUES
  (
    'Cardamom made our daughter''s wedding absolutely magical. Every dish was a conversation starter — guests are still talking about the lamb three months later.',
    'Patricia & James Holloway',
    'Wedding · 180 guests',
    'https://img.rocket.new/generatedImages/rocket_gen_img_1a76b71b8-1766735364749.png',
    5, true, 1
  ),
  (
    'We''ve used Cardamom for our quarterly board lunches for two years. Consistent quality, always on time, and the team is a pleasure to work with.',
    'Marcus Webb',
    'VP Operations · TechNova Inc.',
    'https://img.rocket.new/generatedImages/rocket_gen_img_1ddae73d2-1763292681856.png',
    5, true, 2
  ),
  (
    'The weekly meal prep service changed my life. I eat better than I ever have, and I''ve reclaimed 6 hours a week I used to spend cooking.',
    'Danielle Torres',
    'Meal Prep Subscriber · 8 months',
    'https://img.rocket.new/generatedImages/rocket_gen_img_1098b3c8f-1763293669401.png',
    5, true, 3
  )
ON CONFLICT (id) DO NOTHING;
