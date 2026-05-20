-- Add 'Retail POD' and 'Fadwah Mugs' product categories
INSERT INTO public.categories (name, slug, active, sort_order)
VALUES ('Retail POD', 'retail-pod', true, 7)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.categories (name, slug, active, sort_order)
VALUES ('Fadwah Mugs', 'fadwah-mugs', true, 8)
ON CONFLICT (name) DO NOTHING;
