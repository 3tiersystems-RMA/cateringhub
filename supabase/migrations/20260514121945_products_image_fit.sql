-- Add image_fit column to products table
-- Allows staff to toggle between 'fill' (object-cover) and 'fit' (object-contain) per product image

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_fit TEXT NOT NULL DEFAULT 'fill';
