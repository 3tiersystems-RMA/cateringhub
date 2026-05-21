-- Add hero_badge section key to homepage_section_settings
-- Controls visibility of the "Now Accepting 2026 Bookings" badge in the Hero section

INSERT INTO public.homepage_section_settings (section_key, section_label, is_visible)
VALUES ('hero_badge', 'Hero Badge', true)
ON CONFLICT (section_key) DO NOTHING;
