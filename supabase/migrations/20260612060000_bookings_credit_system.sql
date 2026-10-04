-- ─── Bookings Credit System ───────────────────────────────────────────────────
-- Adds 'no-show' status to Class & Event registration tables (via DB lookup, not hardcoded)
-- Creates customer_credits and customer_credit_transactions tables
-- All statuses are stored in a lookup table so they are never hardcoded

-- 1. Create booking_statuses lookup table (shared by both registration tables)
CREATE TABLE IF NOT EXISTS public.booking_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Seed statuses (idempotent)
INSERT INTO public.booking_statuses (id, label, sort_order) VALUES
  ('pending',                'Pending',                1),
  ('paid',                   'Paid',                   2),
  ('awaiting_confirmation',  'Awaiting Confirmation',  3),
  ('awaiting_payment',       'Awaiting Payment',       4),
  ('failed',                 'Failed',                 5),
  ('no-show',                'No-Show',                6)
ON CONFLICT (id) DO NOTHING;

-- 2. customer_credits table
CREATE TABLE IF NOT EXISTS public.customer_credits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email        TEXT NOT NULL,
  customer_name         TEXT NOT NULL,
  original_booking_ref  TEXT NOT NULL,
  booking_type          TEXT NOT NULL CHECK (booking_type IN ('class', 'event')),
  total_issued          NUMERIC(10,2) NOT NULL CHECK (total_issued > 0),
  total_used            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_used >= 0),
  remaining_balance     NUMERIC(10,2) NOT NULL CHECK (remaining_balance >= 0),
  credit_status         TEXT NOT NULL DEFAULT 'active' CHECK (credit_status IN ('active', 'used')),
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_email ON public.customer_credits(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_credits_status ON public.customer_credits(credit_status);

-- 3. customer_credit_transactions audit trail
CREATE TABLE IF NOT EXISTS public.customer_credit_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id         UUID NOT NULL REFERENCES public.customer_credits(id) ON DELETE CASCADE,
  booking_ref       TEXT NOT NULL,
  booking_type      TEXT NOT NULL CHECK (booking_type IN ('class', 'event')),
  amount_applied    NUMERIC(10,2) NOT NULL CHECK (amount_applied > 0),
  balance_before    NUMERIC(10,2) NOT NULL,
  balance_after     NUMERIC(10,2) NOT NULL,
  applied_by        TEXT NOT NULL DEFAULT 'system',
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_credit_id ON public.customer_credit_transactions(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_booking_ref ON public.customer_credit_transactions(booking_ref);

-- 4. RLS

ALTER TABLE public.booking_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_transactions ENABLE ROW LEVEL SECURITY;

-- booking_statuses: public read (needed by registration forms)
DROP POLICY IF EXISTS "public_read_booking_statuses" ON public.booking_statuses;
CREATE POLICY "public_read_booking_statuses"
  ON public.booking_statuses FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "admin_manage_booking_statuses" ON public.booking_statuses;
CREATE POLICY "admin_manage_booking_statuses"
  ON public.booking_statuses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

-- customer_credits: staff can read/write; anon can read own by email (for registration form lookup)
DROP POLICY IF EXISTS "staff_manage_customer_credits" ON public.customer_credits;
CREATE POLICY "staff_manage_customer_credits"
  ON public.customer_credits FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('staff', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('staff', 'admin', 'super_admin')
    )
  );

-- Allow anon/public to SELECT credits by email (needed during registration credit check)
DROP POLICY IF EXISTS "public_read_credits_by_email" ON public.customer_credits;
CREATE POLICY "public_read_credits_by_email"
  ON public.customer_credits FOR SELECT TO public USING (true);

-- customer_credit_transactions: staff manage; public read (for audit display)
DROP POLICY IF EXISTS "staff_manage_credit_transactions" ON public.customer_credit_transactions;
CREATE POLICY "staff_manage_credit_transactions"
  ON public.customer_credit_transactions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('staff', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "public_read_credit_transactions" ON public.customer_credit_transactions;
CREATE POLICY "public_read_credit_transactions"
  ON public.customer_credit_transactions FOR SELECT TO public USING (true);
