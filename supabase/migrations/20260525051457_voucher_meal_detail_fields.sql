-- Add voucher meal detail fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS attribute1 text,
  ADD COLUMN IF NOT EXISTS attribute2 text,
  ADD COLUMN IF NOT EXISTS attribute3 text,
  ADD COLUMN IF NOT EXISTS long_description text;
