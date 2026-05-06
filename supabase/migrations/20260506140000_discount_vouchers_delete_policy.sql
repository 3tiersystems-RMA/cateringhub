-- Add DELETE RLS policy for staff on discount_vouchers
-- This was missing from the original migration, preventing staff from deleting any discount vouchers

DROP POLICY IF EXISTS "staff_delete_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "staff_delete_discount_vouchers"
ON public.discount_vouchers
FOR DELETE
TO authenticated
USING (public.is_staff_member());
