-- Migration: Add Google Drive file URL columns to cooking_class_registrations
-- These store the full Google Drive view URLs for uploaded files (indemnity form, proof of payment)

ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS indemnity_file_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_of_payment_drive_url TEXT;
