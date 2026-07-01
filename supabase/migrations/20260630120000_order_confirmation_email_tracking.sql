-- PayFast auto-confirmation + EFT order-received email tracking (food orders).
-- Mirrors cooking_class_registrations / event_management_registrations email columns.
-- Manual EFT payment confirmation from staff workspace does not use payfast_* columns.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_error TEXT,
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_resend_id TEXT,
  ADD COLUMN IF NOT EXISTS eft_received_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eft_received_email_error TEXT;
