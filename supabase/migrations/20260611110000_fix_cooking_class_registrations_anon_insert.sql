-- Fix: Allow anonymous (unauthenticated) users to INSERT into cooking_class_registrations
-- Root cause: The anon role was blocked by RLS despite previous fix attempts.
-- This migration drops all existing insert policies and creates a definitive one for anon.

-- Step 1: Drop ALL existing insert policies on cooking_class_registrations (clean slate)
DROP POLICY IF EXISTS "public_insert_cooking_class_registrations" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "public_insert_cooking_class_registrations_v2" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "anon_insert_cooking_class_registrations" ON public.cooking_class_registrations;
DROP POLICY IF EXISTS "allow_anon_insert_cooking_class_registrations" ON public.cooking_class_registrations;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.cooking_class_registrations ENABLE ROW LEVEL SECURITY;

-- Step 3: Create a definitive INSERT policy for the anon role
CREATE POLICY "anon_insert_cooking_class_registrations"
ON public.cooking_class_registrations
FOR INSERT
TO anon
WITH CHECK (true);

-- Step 4: Ensure authenticated users can also insert (for staff/admin use)
DROP POLICY IF EXISTS "authenticated_insert_cooking_class_registrations" ON public.cooking_class_registrations;
CREATE POLICY "authenticated_insert_cooking_class_registrations"
ON public.cooking_class_registrations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 5: Ensure authenticated users can manage all registrations (admin/staff)
DROP POLICY IF EXISTS "authenticated_manage_cooking_class_registrations" ON public.cooking_class_registrations;
CREATE POLICY "authenticated_manage_cooking_class_registrations"
ON public.cooking_class_registrations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 6: Grant explicit table-level INSERT permission to anon role
GRANT INSERT ON public.cooking_class_registrations TO anon;

-- Step 7: Also fix cooking_class_booking_counts for anon INSERT (same issue may exist)
DROP POLICY IF EXISTS "public_insert_cooking_class_booking_counts" ON public.cooking_class_booking_counts;
DROP POLICY IF EXISTS "public_insert_cooking_class_booking_counts_v2" ON public.cooking_class_booking_counts;
DROP POLICY IF EXISTS "anon_insert_cooking_class_booking_counts" ON public.cooking_class_booking_counts;

ALTER TABLE public.cooking_class_booking_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_cooking_class_booking_counts"
ON public.cooking_class_booking_counts
FOR INSERT
TO anon
WITH CHECK (true);

GRANT INSERT ON public.cooking_class_booking_counts TO anon;
