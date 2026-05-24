-- Allow admin (and super_admin) to manage all staff profiles
-- This fixes the "Failed to save changes" error when an admin tries to edit another staff member's role/details

-- Helper function: check if current user is admin or super_admin
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

-- Policy: admin can view and update all staff profiles
DROP POLICY IF EXISTS "admin_manage_all_profiles" ON public.user_profiles;
CREATE POLICY "admin_manage_all_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin_or_super_admin())
WITH CHECK (public.is_admin_or_super_admin());
