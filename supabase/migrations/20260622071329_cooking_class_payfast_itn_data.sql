-- Store PayFast ITN payload on cooking class registrations for admin receipt viewing
ALTER TABLE public.cooking_class_registrations
  ADD COLUMN IF NOT EXISTS payfast_itn_data JSONB;
