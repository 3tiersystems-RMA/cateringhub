-- Per-recipient confirmation email delivery tracking (customer + admin copies).
-- JSON shape: { "customer": { "email", "sent_at", "error", "resend_id" }, "info_admin": {...}, "main_admin": {...} }
ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS confirmation_email_recipients JSONB;

ALTER TABLE public.event_management_registrations
  ADD COLUMN IF NOT EXISTS confirmation_email_recipients JSONB;
