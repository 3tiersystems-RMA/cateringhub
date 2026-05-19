-- Add old_price and saving_percent columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS old_price numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saving_percent numeric(5,2) DEFAULT NULL;
