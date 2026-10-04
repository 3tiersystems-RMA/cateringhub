-- Add banner_text column to homepage_section_settings for the ticker banner
ALTER TABLE public.homepage_section_settings
ADD COLUMN IF NOT EXISTS banner_text TEXT DEFAULT 'Now Accepting 2027 Bookings';

-- Insert the ticker_banner row (or update if already exists)
INSERT INTO public.homepage_section_settings (section_key, section_label, is_visible, banner_text)
VALUES ('ticker_banner', 'Ticker Banner', false, 'Now Accepting 2027 Bookings')
ON CONFLICT (section_key) DO NOTHING;
