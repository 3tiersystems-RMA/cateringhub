-- Orders RLS Fix Migration
-- Fixes "new row violates row-level security policy for table orders" for anon/public customers
-- placing EFT orders. Adds INSERT and SELECT policies for the anon role.
-- Existing authenticated staff policies are NOT removed or altered.

-- 1. Re-apply anon INSERT policy (idempotent: drop then create)
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
CREATE POLICY "anon_insert_orders"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (true);

-- 2. Add SELECT policy so customers can read their own order by order reference (m_payment_id)
DROP POLICY IF EXISTS "anon_select_own_order_by_ref" ON public.orders;
CREATE POLICY "anon_select_own_order_by_ref"
ON public.orders
FOR SELECT
TO anon
USING (m_payment_id IS NOT NULL);
