-- Allow anonymous/public reads of correspondence_settings
-- Required for the /api/delivery-settings route which is called by unauthenticated visitors
-- The service role key bypasses RLS, but this policy ensures the anon key also works as a fallback
DROP POLICY IF EXISTS "public_read_correspondence_settings" ON public.correspondence_settings;
CREATE POLICY "public_read_correspondence_settings"
  ON public.correspondence_settings
  FOR SELECT
  TO anon
  USING (true);
