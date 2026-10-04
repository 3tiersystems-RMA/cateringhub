-- Fix is_staff_member() to include super_admin role.
-- Previously it only checked 'admin' and 'staff', excluding 'super_admin' from
-- storage policies and the staff_view_all_profiles RLS policy.

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
        AND up.role IN ('admin'::public.staff_role, 'staff'::public.staff_role, 'super_admin'::public.staff_role)
    )
$$;
