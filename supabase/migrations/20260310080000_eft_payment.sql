-- EFT Payment Support Migration
-- Adds 'awaiting_payment' to payment_status enum and payment_method column

-- 1. Add new value to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'awaiting_payment';

-- 2. Add payment_method column to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'payfast';
