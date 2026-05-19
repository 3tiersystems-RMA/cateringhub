-- Add product_link column to homepage_cards table
ALTER TABLE public.homepage_cards
  ADD COLUMN IF NOT EXISTS product_link uuid REFERENCES public.products(id) ON DELETE SET NULL;
