-- Add missing INSERT policy for correspondence_settings
-- (SELECT and UPDATE policies already exist from the initial migration)
DROP POLICY IF EXISTS "staff_insert_correspondence_settings" ON public.correspondence_settings;
CREATE POLICY "staff_insert_correspondence_settings"
  ON public.correspondence_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
