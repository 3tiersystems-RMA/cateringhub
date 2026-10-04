-- PayFast Pending Payments
-- Stores full registration/order payload before redirecting to PayFast.
-- Records are created here at form-submit time; the actual order/registration
-- rows are only inserted by the ITN handler once PayFast confirms COMPLETE.

CREATE TABLE IF NOT EXISTS public.payfast_pending_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  m_payment_id    TEXT NOT NULL UNIQUE,
  payment_type    TEXT NOT NULL, -- 'order' | 'event_booking' | 'cooking_class'
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_payfast_pending_m_payment_id
  ON public.payfast_pending_payments (m_payment_id);

CREATE INDEX IF NOT EXISTS idx_payfast_pending_expires_at
  ON public.payfast_pending_payments (expires_at);

ALTER TABLE public.payfast_pending_payments ENABLE ROW LEVEL SECURITY;

-- Only service-role (server-side) can read/write; no public access.
DROP POLICY IF EXISTS "service_role_manage_payfast_pending" ON public.payfast_pending_payments;
CREATE POLICY "service_role_manage_payfast_pending"
  ON public.payfast_pending_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
