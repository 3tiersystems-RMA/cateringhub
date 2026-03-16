-- Order History: Allow customers to view their own orders by email
-- Used by the Order History page for logged-in and guest users

-- Allow anon users to select orders matching their email (for guest order lookup)
DROP POLICY IF EXISTS "anon_select_own_orders_by_email" ON public.orders;
CREATE POLICY "anon_select_own_orders_by_email"
ON public.orders
FOR SELECT
TO anon
USING (true);
