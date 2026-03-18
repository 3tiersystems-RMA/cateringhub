-- Discount Vouchers Migration
-- Creates discount_vouchers table for staff-generated discount coupons

-- 1. Discount voucher status type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_voucher_status') THEN
    CREATE TYPE public.discount_voucher_status AS ENUM ('Active', 'Inactive');
  END IF;
END$$;

-- 2. Discount vouchers table
CREATE TABLE IF NOT EXISTS public.discount_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dv_code TEXT NOT NULL UNIQUE,
    dv_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status public.discount_voucher_status NOT NULL DEFAULT 'Active'::public.discount_voucher_status,
    expiry_date DATE NOT NULL,
    times_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_discount_vouchers_dv_code ON public.discount_vouchers(dv_code);
CREATE INDEX IF NOT EXISTS idx_discount_vouchers_status ON public.discount_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_discount_vouchers_expiry_date ON public.discount_vouchers(expiry_date);

-- 4. Updated_at trigger
DROP TRIGGER IF EXISTS update_discount_vouchers_updated_at ON public.discount_vouchers;
CREATE TRIGGER update_discount_vouchers_updated_at
    BEFORE UPDATE ON public.discount_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Enable RLS
ALTER TABLE public.discount_vouchers ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Authenticated staff can read all discount vouchers
DROP POLICY IF EXISTS "staff_read_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "staff_read_discount_vouchers"
ON public.discount_vouchers
FOR SELECT
TO authenticated
USING (public.is_staff_member());

-- Authenticated staff can insert discount vouchers
DROP POLICY IF EXISTS "staff_insert_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "staff_insert_discount_vouchers"
ON public.discount_vouchers
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_member());

-- Authenticated staff can update discount vouchers (edit, no delete)
DROP POLICY IF EXISTS "staff_update_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "staff_update_discount_vouchers"
ON public.discount_vouchers
FOR UPDATE
TO authenticated
USING (public.is_staff_member())
WITH CHECK (public.is_staff_member());

-- Anonymous users can read active discount vouchers (for checkout validation)
DROP POLICY IF EXISTS "anon_read_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "anon_read_discount_vouchers"
ON public.discount_vouchers
FOR SELECT
TO anon
USING (true);

-- Anonymous users can update times_used (when applying at checkout)
DROP POLICY IF EXISTS "anon_update_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "anon_update_discount_vouchers"
ON public.discount_vouchers
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Service role full access
DROP POLICY IF EXISTS "service_role_all_discount_vouchers" ON public.discount_vouchers;
CREATE POLICY "service_role_all_discount_vouchers"
ON public.discount_vouchers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
