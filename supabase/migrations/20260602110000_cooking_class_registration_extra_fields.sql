-- Migration: Add medical details, pictures_taken, and indemnity_consent to cooking_class_registrations
-- These fields are collected on the form but were missing from the database table

ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS medical_doctor_first_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS medical_doctor_surname TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS medical_aid_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS medical_aid_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pictures_taken TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS indemnity_consent BOOLEAN DEFAULT false;
