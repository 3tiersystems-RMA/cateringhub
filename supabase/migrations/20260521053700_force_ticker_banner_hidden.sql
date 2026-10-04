-- Force ticker_banner to hidden state
-- This migration ensures the Sticker Banner is NOT shown unless explicitly toggled ON via the workspace
-- Runs after all previous ticker_banner migrations to override any accidental visible state

UPDATE public.homepage_section_settings
SET is_visible = false
WHERE section_key = 'ticker_banner';
