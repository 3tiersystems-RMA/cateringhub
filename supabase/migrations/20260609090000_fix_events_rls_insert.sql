-- Fix RLS for events table: ensure authenticated staff can INSERT/UPDATE/DELETE
-- The FOR ALL policy sometimes doesn't cover INSERT in all Supabase versions;
-- replace with explicit per-operation policies (same pattern as fix_event_dates_rls_insert).

-- Drop the existing all-operations policy
DROP POLICY IF EXISTS "staff_manage_events" ON public.events;

-- Explicit SELECT for public (published events only)
DROP POLICY IF EXISTS "public_read_published_events" ON public.events;
CREATE POLICY "public_read_published_events"
ON public.events FOR SELECT TO public USING (is_published = true);

-- Explicit SELECT for authenticated (staff can see all events)
DROP POLICY IF EXISTS "authenticated_select_events" ON public.events;
CREATE POLICY "authenticated_select_events"
ON public.events FOR SELECT TO authenticated USING (true);

-- Explicit INSERT for authenticated
DROP POLICY IF EXISTS "authenticated_insert_events" ON public.events;
CREATE POLICY "authenticated_insert_events"
ON public.events FOR INSERT TO authenticated WITH CHECK (true);

-- Explicit UPDATE for authenticated
DROP POLICY IF EXISTS "authenticated_update_events" ON public.events;
CREATE POLICY "authenticated_update_events"
ON public.events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Explicit DELETE for authenticated
DROP POLICY IF EXISTS "authenticated_delete_events" ON public.events;
CREATE POLICY "authenticated_delete_events"
ON public.events FOR DELETE TO authenticated USING (true);
