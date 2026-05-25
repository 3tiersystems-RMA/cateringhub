-- Add visual_type column to products table
-- Values: 'Macro' | 'Micro' | null (not set)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS visual_type text DEFAULT NULL
  CHECK (visual_type IS NULL OR visual_type = ANY (ARRAY['Macro'::text, 'Micro'::text]));

COMMENT ON COLUMN public.products.visual_type IS 'Visual type of the product: Macro (cannot be ordered directly) or Micro (can be ordered). Products with package_type containing ''package'' default to Micro.';
