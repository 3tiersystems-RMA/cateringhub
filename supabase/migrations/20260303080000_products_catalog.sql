-- Products Catalog Migration
-- Creates products table for staff to manage and public to view

-- 1. Category enum
DROP TYPE IF EXISTS public.product_category CASCADE;
CREATE TYPE public.product_category AS ENUM ('Catering Packages', 'Prepared Meals', 'À La Carte');

-- 2. Products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category public.product_category NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'per serving',
    image_path TEXT,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    badge TEXT,
    min_order INTEGER,
    available BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_available ON public.products(available);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON public.products(sort_order);

-- 4. Update trigger function (reuse existing or create)
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Public can read available products
DROP POLICY IF EXISTS "public_read_products" ON public.products;
CREATE POLICY "public_read_products"
ON public.products
FOR SELECT
TO public
USING (true);

-- Staff can insert products
DROP POLICY IF EXISTS "staff_insert_products" ON public.products;
CREATE POLICY "staff_insert_products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_member());

-- Staff can update products
DROP POLICY IF EXISTS "staff_update_products" ON public.products;
CREATE POLICY "staff_update_products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_staff_member())
WITH CHECK (public.is_staff_member());

-- Staff can delete products
DROP POLICY IF EXISTS "staff_delete_products" ON public.products;
CREATE POLICY "staff_delete_products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_staff_member());

-- 7. Trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_products_updated_at();

-- 8. Make product-images bucket public for product display
UPDATE storage.buckets
SET public = true
WHERE id = 'product-images';

-- Add public read policy for product-images
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- 9. Sample products data
DO $$
BEGIN
    INSERT INTO public.products (name, category, price, unit, description, tags, badge, min_order, available, featured, sort_order)
    VALUES
        ('Classic American BBQ Package', 'Catering Packages'::public.product_category, 38.00, 'per head', 'Slow-smoked pulled pork, BBQ ribs, grilled corn, coleslaw, and cornbread. Minimum 30 guests.', ARRAY['Crowd Pleaser', 'Outdoor'], 'Best Seller', 30, true, true, 1),
        ('Elegant Plated Dinner', 'Catering Packages'::public.product_category, 72.00, 'per head', 'Three-course plated dinner with amuse-bouche, choice of entree, and dessert. Staff included.', ARRAY['Fine Dining', 'Wedding'], 'Premium', 20, true, true, 2),
        ('Mediterranean Buffet', 'Catering Packages'::public.product_category, 45.00, 'per head', 'Mezze station, grilled meats, roasted vegetables, couscous, and baklava dessert.', ARRAY['Vegetarian Friendly', 'Buffet'], NULL, 25, true, false, 3),
        ('Corporate Lunch Box', 'Catering Packages'::public.product_category, 18.00, 'per box', 'Gourmet sandwich or wrap, seasonal salad, fresh fruit, and a cookie. Minimum 10 boxes.', ARRAY['Corporate', 'Individual'], NULL, 10, true, false, 4),
        ('Herb-Roasted Chicken & Vegetables', 'Prepared Meals'::public.product_category, 14.00, 'per serving', 'Free-range chicken thighs roasted with rosemary, garlic, and seasonal root vegetables.', ARRAY['High Protein', 'Gluten-Free'], 'Weekly Pick', NULL, true, true, 5),
        ('Truffle Mushroom Risotto', 'Prepared Meals'::public.product_category, 16.00, 'per serving', 'Arborio rice slow-cooked with wild mushrooms, truffle oil, and aged Parmigiano-Reggiano.', ARRAY['Vegetarian', 'Comfort'], NULL, NULL, true, false, 6),
        ('Teriyaki Salmon Bowl', 'Prepared Meals'::public.product_category, 18.00, 'per serving', 'Atlantic salmon in house teriyaki glaze, brown rice, edamame, pickled ginger, sesame.', ARRAY['Omega-3', 'Low Carb Option'], NULL, NULL, true, false, 7),
        ('Braised Short Rib & Mash', 'Prepared Meals'::public.product_category, 22.00, 'per serving', '48-hour braised beef short rib, truffle mashed potatoes, red wine reduction, gremolata.', ARRAY['High Protein', 'Comfort'], 'Chef''s Pick', NULL, true, true, 8),
        ('Thai Green Curry', 'Prepared Meals'::public.product_category, 13.00, 'per serving', 'House-made green curry paste, coconut milk, seasonal vegetables, jasmine rice, Thai basil.', ARRAY['Vegan', 'Spicy'], NULL, NULL, true, false, 9),
        ('Charcuterie & Cheese Board', 'À La Carte'::public.product_category, 65.00, 'per board (serves 8-10)', 'Curated selection of 4 artisan cheeses, 3 cured meats, seasonal fruit, nuts, and house crackers.', ARRAY['Entertaining', 'Crowd Favorite'], 'Most Ordered', NULL, true, true, 10),
        ('Seasonal Salad Platter', 'À La Carte'::public.product_category, 42.00, 'per platter (serves 6-8)', 'Market greens, roasted beets, candied walnuts, goat cheese, house vinaigrette on the side.', ARRAY['Vegan Option', 'Fresh'], NULL, NULL, true, false, 11),
        ('Dessert Petit Fours', 'À La Carte'::public.product_category, 48.00, 'per dozen', 'Rotating seasonal selection of 4 varieties: macarons, chocolate truffles, lemon tartlets, eclairs.', ARRAY['Sweet', 'Elegant'], NULL, NULL, true, false, 12)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sample products insertion skipped: %', SQLERRM;
END $$;
