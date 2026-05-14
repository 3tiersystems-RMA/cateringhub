-- Add '03 / The Process' section to homepage section visibility settings
INSERT INTO public.homepage_section_settings (section_key, section_label, is_visible)
VALUES
  ('the_process', '03 / The Process', true)
ON CONFLICT (section_key) DO NOTHING;
