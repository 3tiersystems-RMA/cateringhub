-- Fix RLS policies for event_management_registrations and event_management_booking_counts
-- Ensure public (unauthenticated) users can INSERT registrations and booking counts

-- event_management_registrations: ensure public insert policy exists
DROP POLICY IF EXISTS public_insert_event_management_registrations ON public.event_management_registrations;
CREATE POLICY public_insert_event_management_registrations
ON public.event_management_registrations FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS public_insert_event_management_registrations_v2 ON public.event_management_registrations;
CREATE POLICY public_insert_event_management_registrations_v2
ON public.event_management_registrations FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS staff_manage_event_management_registrations ON public.event_management_registrations;
CREATE POLICY staff_manage_event_management_registrations
ON public.event_management_registrations FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
);

-- event_management_booking_counts: ensure public insert + read policies exist
ALTER TABLE public.event_management_booking_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_insert_event_management_booking_counts ON public.event_management_booking_counts;
CREATE POLICY public_insert_event_management_booking_counts
ON public.event_management_booking_counts FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS public_insert_event_management_booking_counts_v2 ON public.event_management_booking_counts;
CREATE POLICY public_insert_event_management_booking_counts_v2
ON public.event_management_booking_counts FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS public_read_event_management_booking_counts ON public.event_management_booking_counts;
CREATE POLICY public_read_event_management_booking_counts
ON public.event_management_booking_counts FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS staff_manage_event_management_booking_counts ON public.event_management_booking_counts;
CREATE POLICY staff_manage_event_management_booking_counts
ON public.event_management_booking_counts FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
);
