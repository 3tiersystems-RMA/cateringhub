-- Super Admin Migration
-- Adds super_admin to staff_role ENUM, updates RLS policies and is_staff_member function

-- 1. Add 'super_admin' to the staff_role ENUM
-- ALTER TYPE ADD VALUE must run outside a transaction block in Supabase migrations
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Update is_staff_member() to include super_admin
-- Use text comparison to avoid referencing the new enum value before it is committed
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

-- 3. Create helper function to check if current user is super_admin
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

-- 4. Add RLS policy so super_admin can view and manage ALL user_profiles
-- (existing own-profile policy remains; we add a super_admin override)
DROP POLICY IF EXISTS "super_admin_manage_all_profiles" ON public.user_profiles;
CREATE POLICY "super_admin_manage_all_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 5. Update handle_new_user trigger to support super_admin role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.staff_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
