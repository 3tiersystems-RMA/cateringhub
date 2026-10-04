-- Add 'Wellness' product category
INSERT INTO public.categories (name, slug, active, sort_order)
VALUES ('Wellness', 'wellness', true, 6)
ON CONFLICT (name) DO NOTHING;
