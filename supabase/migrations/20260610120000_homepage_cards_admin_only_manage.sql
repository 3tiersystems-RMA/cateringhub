-- Restrict homepage_cards writes to Admin and Super Admin only.
-- Staff can still read visible cards on the public homepage (existing SELECT policy).

DROP POLICY IF EXISTS "staff_can_manage_homepage_cards" ON public.homepage_cards;

CREATE POLICY "admin_can_manage_homepage_cards"
ON public.homepage_cards
FOR ALL
TO authenticated
USING (public.is_admin_or_super_admin())
WITH CHECK (public.is_admin_or_super_admin());
