-- Fix booking EB-PANQ2IZQ: reduce amount from R120 to R70 after credit CC-1M0A4EOC (R50) was applied
UPDATE public.event_management_registrations
SET amount = 70.00,
    updated_at = now()
WHERE registration_code = 'EB-PANQ2IZQ'
  AND amount = 120.00;
