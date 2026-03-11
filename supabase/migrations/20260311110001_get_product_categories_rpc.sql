-- Add RPC function to get product categories from the enum
-- This allows the frontend to dynamically fetch categories without hardcoding

CREATE OR REPLACE FUNCTION public.get_product_categories()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(enumlabel ORDER BY enumsortorder)
  FROM pg_enum
  WHERE enumtypid = (
    SELECT oid FROM pg_type WHERE typname = 'product_category'
  );
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_product_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_categories() TO anon;
