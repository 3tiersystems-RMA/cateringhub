-- Fix RLS policies for cooking_class_registrations and cooking_class_booking_counts
-- Ensure public (unauthenticated) users can INSERT registrations and booking counts

-- cooking_class_registrations: ensure public insert policy exists
DROP POLICY IF EXISTS "public_insert_cooking_class_registrations" ON public.cooking_class_registrations;
CREATE POLICY "public_insert_cooking_class_registrations"
ON public.cooking_class_registrations FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_cooking_class_registrations_v2" ON public.cooking_class_registrations;
CREATE POLICY "public_insert_cooking_class_registrations_v2"
ON public.cooking_class_registrations FOR INSERT TO public WITH CHECK (true);

-- cooking_class_booking_counts: ensure public insert policy exists
ALTER TABLE public.cooking_class_booking_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_cooking_class_booking_counts" ON public.cooking_class_booking_counts;
CREATE POLICY "public_insert_cooking_class_booking_counts"
ON public.cooking_class_booking_counts FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_cooking_class_booking_counts_v2" ON public.cooking_class_booking_counts;
CREATE POLICY "public_insert_cooking_class_booking_counts_v2"
ON public.cooking_class_booking_counts FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_cooking_class_booking_counts" ON public.cooking_class_booking_counts;
CREATE POLICY "public_read_cooking_class_booking_counts"
ON public.cooking_class_booking_counts FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_cooking_class_booking_counts" ON public.cooking_class_booking_counts;
CREATE POLICY "authenticated_manage_cooking_class_booking_counts"
ON public.cooking_class_booking_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);
