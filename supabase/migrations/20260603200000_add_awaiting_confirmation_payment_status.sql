-- Add 'awaiting_confirmation' to the payment_status enum
-- This status is set when PayFast returns a successful payment notification,
-- pending final manual or automated confirmation.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
