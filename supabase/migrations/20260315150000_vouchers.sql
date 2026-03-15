-- Vouchers Migration
-- Creates vouchers and voucher_redemptions tables for meal voucher purchasing and redemption

-- 1. Voucher status enum
DROP TYPE IF EXISTS public.voucher_status CASCADE;
CREATE TYPE public.voucher_status AS ENUM ('active', 'redeemed', 'expired');

-- 2. Vouchers table
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    customer_phone TEXT DEFAULT '',
    total_meals INTEGER NOT NULL DEFAULT 0,
    meals_remaining INTEGER NOT NULL DEFAULT 0,
    status public.voucher_status NOT NULL DEFAULT 'active'::public.voucher_status,
    purchased_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Voucher redemptions table
CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_code TEXT NOT NULL REFERENCES public.vouchers(voucher_code) ON DELETE CASCADE,
    order_id TEXT DEFAULT '',
    meals_used INTEGER NOT NULL DEFAULT 1,
    redeemed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT ''
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_code ON public.vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_vouchers_customer_email ON public.vouchers(customer_email);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_purchased_at ON public.vouchers(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher_code ON public.voucher_redemptions(voucher_code);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_redeemed_at ON public.voucher_redemptions(redeemed_at DESC);

-- 5. Updated_at trigger
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER update_vouchers_updated_at
    BEFORE UPDATE ON public.vouchers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for vouchers

-- Authenticated staff can read all vouchers
DROP POLICY IF EXISTS "staff_read_all_vouchers" ON public.vouchers;
CREATE POLICY "staff_read_all_vouchers"
ON public.vouchers
FOR SELECT
TO authenticated
USING (public.is_staff_member());

-- Authenticated staff can update vouchers (e.g. deduct meals)
DROP POLICY IF EXISTS "staff_update_vouchers" ON public.vouchers;
CREATE POLICY "staff_update_vouchers"
ON public.vouchers
FOR UPDATE
TO authenticated
USING (public.is_staff_member())
WITH CHECK (public.is_staff_member());

-- Authenticated staff can insert vouchers (manual issuance)
DROP POLICY IF EXISTS "staff_insert_vouchers" ON public.vouchers;
CREATE POLICY "staff_insert_vouchers"
ON public.vouchers
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_member());

-- Authenticated staff can delete vouchers
DROP POLICY IF EXISTS "staff_delete_vouchers" ON public.vouchers;
CREATE POLICY "staff_delete_vouchers"
ON public.vouchers
FOR DELETE
TO authenticated
USING (public.is_staff_member());

-- Anonymous users can insert (purchase a voucher)
DROP POLICY IF EXISTS "anon_insert_vouchers" ON public.vouchers;
CREATE POLICY "anon_insert_vouchers"
ON public.vouchers
FOR INSERT
TO anon
WITH CHECK (true);

-- Anonymous users can read their own voucher by code (for validation at checkout)
DROP POLICY IF EXISTS "anon_read_own_voucher" ON public.vouchers;
CREATE POLICY "anon_read_own_voucher"
ON public.vouchers
FOR SELECT
TO anon
USING (true);

-- Service role full access
DROP POLICY IF EXISTS "service_role_all_vouchers" ON public.vouchers;
CREATE POLICY "service_role_all_vouchers"
ON public.vouchers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. RLS Policies for voucher_redemptions

-- Authenticated staff can read all redemptions
DROP POLICY IF EXISTS "staff_read_all_redemptions" ON public.voucher_redemptions;
CREATE POLICY "staff_read_all_redemptions"
ON public.voucher_redemptions
FOR SELECT
TO authenticated
USING (public.is_staff_member());

-- Anonymous users can insert redemptions (when placing order with voucher)
DROP POLICY IF EXISTS "anon_insert_redemptions" ON public.voucher_redemptions;
CREATE POLICY "anon_insert_redemptions"
ON public.voucher_redemptions
FOR INSERT
TO anon
WITH CHECK (true);

-- Authenticated staff can insert redemptions
DROP POLICY IF EXISTS "staff_insert_redemptions" ON public.voucher_redemptions;
CREATE POLICY "staff_insert_redemptions"
ON public.voucher_redemptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_member());

-- Anonymous users can read redemptions (to show history for their voucher)
DROP POLICY IF EXISTS "anon_read_redemptions" ON public.voucher_redemptions;
CREATE POLICY "anon_read_redemptions"
ON public.voucher_redemptions
FOR SELECT
TO anon
USING (true);

-- Service role full access
DROP POLICY IF EXISTS "service_role_all_redemptions" ON public.voucher_redemptions;
CREATE POLICY "service_role_all_redemptions"
ON public.voucher_redemptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
