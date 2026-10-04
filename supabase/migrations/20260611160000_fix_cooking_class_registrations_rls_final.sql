-- Final fix: RLS policy for cooking_class_registrations anon INSERT
-- Previous migrations may not have been applied or were overridden.
-- This migration takes a definitive approach using TO public role.

-- Step 1: Drop ALL existing insert policies (clean slate)
DROP POLICY IF EXISTS "public_insert_cooking_class_registrations" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "public_insert_cooking_class_registrations_v2" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "anon_insert_cooking_class_registrations" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "allow_anon_insert_cooking_class_registrations" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "authenticated_insert_cooking_class_registrations" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "authenticated_manage_cooking_class_registrations" ON public.cooking_class_registrations;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.cooking_class_registrations ENABLE ROW LEVEL SECURITY;

-- Step 3: Single INSERT policy for ALL roles (anon + authenticated)
CREATE POLICY "anyone_can_insert_cooking_class_registrations"
ON public.cooking_class_registrations
FOR INSERT
TO public
WITH CHECK (true);

-- Step 4: Authenticated users can manage all registrations (admin/staff)
CREATE POLICY "authenticated_manage_cooking_class_registrations"
ON public.cooking_class_registrations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 5: Explicit table-level grants to ensure anon role has INSERT permission
GRANT INSERT ON public.cooking_class_registrations TO anon;
GRANT INSERT ON public.cooking_class_registrations TO authenticated;

-- Step 6: Fix cooking_class_booking_counts for anon INSERT as well
DROP POLICY IF EXISTS "public_insert_cooking_class_booking_counts" ON public.cooking_class_booking_counts;
DROP POLICY IF EXISTS "public_insert_cooking_class_booking_counts_v2" ON public.cooking_class_booking_counts;
DROP POLICY IF EXISTS "anon_insert_cooking_class_booking_counts" ON public.cooking_class_booking_counts;
DROP POLICY IF EXISTS "authenticated_manage_cooking_class_booking_counts" ON public.cooking_class_booking_counts;

ALTER TABLE public.cooking_class_booking_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_insert_cooking_class_booking_counts"
ON public.cooking_class_booking_counts
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "authenticated_manage_cooking_class_booking_counts"
ON public.cooking_class_booking_counts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT INSERT ON public.cooking_class_booking_counts TO anon;
GRANT INSERT ON public.cooking_class_booking_counts TO authenticated;
