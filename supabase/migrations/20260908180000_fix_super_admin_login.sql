-- Ensure super_admin users can always read their own profile.
-- The backfill migration (20260303120000) may have inserted profiles with role='staff'
-- for users who were created before the super_admin role existed.
-- This migration also adds a direct self-read policy as a safety net so the login
-- page can always fetch the profile regardless of other policy evaluation order.

-- 1. Drop and recreate the self-read policy to be explicit about SELECT
--    (the existing FOR ALL policy covers it, but an explicit SELECT policy
--    ensures the login profile lookup always succeeds even if other policies fail)
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 2. Ensure the is_staff_member() function uses text comparison (most compatible)
CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role::text IN ('admin', 'staff', 'super_admin')
    )
$$;

-- 3. Ensure is_super_admin() uses text comparison (most compatible)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role::text = 'super_admin'
    )
$$;

-- 4. Ensure is_admin_or_super_admin() uses text comparison (most compatible)
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.is_active = true
      AND up.role::text IN ('admin', 'super_admin')
  )
$$;
