-- PayFast auto-confirmation email tracking (cooking class + event registrations).
-- Not used by manual EFT staff confirmation flows.
ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_error TEXT,
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_resend_id TEXT;

ALTER TABLE public.event_management_registrations
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_error TEXT,
  ADD COLUMN IF NOT EXISTS payfast_confirmation_email_resend_id TEXT;
