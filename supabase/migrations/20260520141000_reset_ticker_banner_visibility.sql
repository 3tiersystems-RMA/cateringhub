-- Reset ticker_banner visibility to false (hidden by default)
-- This ensures the Sticker Banner is hidden unless explicitly enabled via the Homepage Cards tab
UPDATE public.homepage_section_settings
SET is_visible = false
WHERE section_key = 'ticker_banner';
