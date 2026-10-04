-- Orders Delete Policy Migration
-- Adds a DELETE RLS policy so super_admin users can permanently delete orders.
-- Without this policy, Supabase silently blocks the delete (RLS violation),
-- causing deleted orders to reappear after page reload / redeployment.

-- 1. Create a helper function to check if the current user is a super_admin
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
        AND up.role = 'super_admin'::public.staff_role
    )
$$;

-- 2. Add DELETE policy for super_admin on orders
DROP POLICY IF EXISTS "super_admin_delete_orders" ON public.orders;
CREATE POLICY "super_admin_delete_orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.is_super_admin());
