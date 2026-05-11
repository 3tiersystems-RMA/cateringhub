-- Product Categories Table Migration
-- Creates a standalone categories table, seeds it with existing categories,
-- and converts products.category from enum to plain text.

-- ─── 1. Create categories table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- ─── 2. Enable RLS on categories ─────────────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public can read all categories
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
ON public.categories
FOR SELECT
TO public
USING (true);

-- Staff can insert categories
DROP POLICY IF EXISTS "staff_insert_categories" ON public.categories;
CREATE POLICY "staff_insert_categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_member());

-- Staff can update categories
DROP POLICY IF EXISTS "staff_update_categories" ON public.categories;
CREATE POLICY "staff_update_categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.is_staff_member())
WITH CHECK (public.is_staff_member());

-- Staff can delete categories
DROP POLICY IF EXISTS "staff_delete_categories" ON public.categories;
CREATE POLICY "staff_delete_categories"
ON public.categories
FOR DELETE
TO authenticated
USING (public.is_staff_member());

-- ─── 3. Seed categories from existing enum values ────────────────────────────
INSERT INTO public.categories (name, slug, active, sort_order)
VALUES
    ('Catering Packages', 'catering-packages', true, 1),
    ('Packaged Meals',    'packaged-meals',    true, 2),
    ('À La Carte',        'a-la-carte',        true, 3),
    ('Frozen Meals',      'frozen-meals',      true, 4)
ON CONFLICT (name) DO UPDATE
    SET slug       = EXCLUDED.slug,
        sort_order = EXCLUDED.sort_order,
        active     = EXCLUDED.active;

-- ─── 4. Convert products.category from enum to TEXT ──────────────────────────
-- Step 4a: Add a temporary text column
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS category_text TEXT;

-- Step 4b: Copy enum values to text column
UPDATE public.products
SET category_text = category::TEXT
WHERE category_text IS NULL;

-- Step 4c: Drop the old enum column
ALTER TABLE public.products
DROP COLUMN IF EXISTS category;

-- Step 4d: Rename text column to category
ALTER TABLE public.products
RENAME COLUMN category_text TO category;

-- Step 4e: Set NOT NULL constraint
ALTER TABLE public.products
ALTER COLUMN category SET NOT NULL;

-- Step 4f: Recreate index on category
DROP INDEX IF EXISTS idx_products_category;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- ─── 5. Update get_product_categories RPC to use categories table ─────────────
CREATE OR REPLACE FUNCTION public.get_product_categories()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(name ORDER BY sort_order, name)
  FROM public.categories
  WHERE active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_categories() TO anon;
