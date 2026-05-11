-- ─── Order Audit Trail ────────────────────────────────────────────────────────
-- Tracks every status change, payment update, and fulfilment event per order.

CREATE TABLE IF NOT EXISTS public.order_audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL,
  event_type      TEXT NOT NULL,
  field_changed   TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT NOT NULL,
  changed_by      TEXT NOT NULL DEFAULT 'system',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_audit_trail_order_id
  ON public.order_audit_trail (order_id);

CREATE INDEX IF NOT EXISTS idx_order_audit_trail_created_at
  ON public.order_audit_trail (created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.order_audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_order_audit_trail" ON public.order_audit_trail;
CREATE POLICY "staff_read_order_audit_trail"
  ON public.order_audit_trail
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "staff_insert_order_audit_trail" ON public.order_audit_trail;
CREATE POLICY "staff_insert_order_audit_trail"
  ON public.order_audit_trail
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── Trigger function: auto-log order changes ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_order_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  -- Payment status change
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.order_audit_trail
      (order_id, event_type, field_changed, old_value, new_value, changed_by)
    VALUES
      (NEW.id, 'payment_update', 'payment_status',
       OLD.payment_status::TEXT, NEW.payment_status::TEXT, 'staff');
  END IF;

  -- Fulfillment status change
  IF OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status THEN
    INSERT INTO public.order_audit_trail
      (order_id, event_type, field_changed, old_value, new_value, changed_by)
    VALUES
      (NEW.id, 'fulfillment_update', 'fulfillment_status',
       OLD.fulfillment_status::TEXT, NEW.fulfillment_status::TEXT, 'staff');
  END IF;

  -- Delivered date set
  IF OLD.delivered_date IS DISTINCT FROM NEW.delivered_date AND NEW.delivered_date IS NOT NULL THEN
    INSERT INTO public.order_audit_trail
      (order_id, event_type, field_changed, old_value, new_value, changed_by)
    VALUES
      (NEW.id, 'fulfillment_event', 'delivered_date',
       COALESCE(OLD.delivered_date::TEXT, 'not set'), NEW.delivered_date::TEXT, 'staff');
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_order_audit_trail ON public.orders;
CREATE TRIGGER trg_order_audit_trail
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_audit_trail();

-- ─── Seed: create audit entries for existing orders ───────────────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, payment_status, fulfillment_status, created_at FROM public.orders LOOP
    INSERT INTO public.order_audit_trail
      (order_id, event_type, field_changed, old_value, new_value, changed_by, created_at)
    VALUES
      (rec.id, 'order_created', 'payment_status', NULL, rec.payment_status::TEXT, 'system', rec.created_at),
      (rec.id, 'order_created', 'fulfillment_status', NULL, rec.fulfillment_status::TEXT, 'system', rec.created_at)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed audit trail failed: %', SQLERRM;
END $$;
