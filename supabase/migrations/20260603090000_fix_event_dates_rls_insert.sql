-- Fix RLS for cooking_class_event_dates: ensure authenticated staff can INSERT/UPDATE/DELETE
-- The FOR ALL policy sometimes doesn't cover INSERT in all Supabase versions; add explicit policies.

-- Drop and recreate the all-operations policy
DROP POLICY IF EXISTS "authenticated_manage_cooking_class_event_dates" ON public.cooking_class_event_dates;

-- Explicit SELECT for public
DROP POLICY IF EXISTS "public_read_cooking_class_event_dates" ON public.cooking_class_event_dates;
CREATE POLICY "public_read_cooking_class_event_dates"
ON public.cooking_class_event_dates FOR SELECT TO public USING (true);

-- Explicit INSERT for authenticated
DROP POLICY IF EXISTS "authenticated_insert_cooking_class_event_dates" ON public.cooking_class_event_dates;
CREATE POLICY "authenticated_insert_cooking_class_event_dates"
ON public.cooking_class_event_dates FOR INSERT TO authenticated WITH CHECK (true);

-- Explicit UPDATE for authenticated
DROP POLICY IF EXISTS "authenticated_update_cooking_class_event_dates" ON public.cooking_class_event_dates;
CREATE POLICY "authenticated_update_cooking_class_event_dates"
ON public.cooking_class_event_dates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Explicit DELETE for authenticated
DROP POLICY IF EXISTS "authenticated_delete_cooking_class_event_dates" ON public.cooking_class_event_dates;
CREATE POLICY "authenticated_delete_cooking_class_event_dates"
ON public.cooking_class_event_dates FOR DELETE TO authenticated USING (true);
