-- Add 'Voucher Meals' product category
INSERT INTO public.categories (name, slug, active, sort_order)
VALUES ('Voucher Meals', 'voucher-meals', true, 5)
ON CONFLICT (name) DO NOTHING;
