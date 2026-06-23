-- Failed Payment Transactions — bookings history status for PayFast failures (events + classes).
-- No customer-facing registration reference is assigned when this status is used.

INSERT INTO public.booking_statuses (id, label, sort_order) VALUES
  ('failed_payment_transaction', 'Failed Payment Transactions', 7)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;
