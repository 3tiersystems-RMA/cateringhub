-- Guest carts: persistent cart storage for unauthenticated customers
CREATE TABLE IF NOT EXISTS public.guest_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token TEXT NOT NULL UNIQUE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_email TEXT,
  customer_name TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_carts_guest_token ON public.guest_carts(guest_token);
CREATE INDEX IF NOT EXISTS idx_guest_carts_last_activity ON public.guest_carts(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_guest_carts_reminder_sent ON public.guest_carts(reminder_sent_at);

ALTER TABLE public.guest_carts ENABLE ROW LEVEL SECURITY;

-- Public can insert/update their own cart via guest_token (no auth required)
DROP POLICY IF EXISTS "guest_carts_public_insert" ON public.guest_carts;
CREATE POLICY "guest_carts_public_insert"
  ON public.guest_carts
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "guest_carts_public_select" ON public.guest_carts;
CREATE POLICY "guest_carts_public_select"
  ON public.guest_carts
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "guest_carts_public_update" ON public.guest_carts;
CREATE POLICY "guest_carts_public_update"
  ON public.guest_carts
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "guest_carts_public_delete" ON public.guest_carts;
CREATE POLICY "guest_carts_public_delete"
  ON public.guest_carts
  FOR DELETE
  TO public
  USING (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_guest_cart_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_carts_updated_at ON public.guest_carts;
CREATE TRIGGER trg_guest_carts_updated_at
  BEFORE UPDATE ON public.guest_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_guest_cart_updated_at();
