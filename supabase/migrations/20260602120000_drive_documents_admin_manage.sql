-- Align drive_documents write access with the client role matrix:
-- Document Management = Full CRUD for admin AND super_admin (staff = view only).
-- Previously only super_admin could insert/update/delete.

-- Helper: current user is admin or super_admin (active).
CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.is_active = true
      AND up.role::text IN ('admin', 'super_admin')
  )
$$;

-- INSERT: admin + super_admin
DROP POLICY IF EXISTS "super_admin_insert_drive_documents" ON public.drive_documents;
DROP POLICY IF EXISTS "admin_insert_drive_documents" ON public.drive_documents;
CREATE POLICY "admin_insert_drive_documents"
  ON public.drive_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super());

-- UPDATE: admin + super_admin
DROP POLICY IF EXISTS "super_admin_update_drive_documents" ON public.drive_documents;
DROP POLICY IF EXISTS "admin_update_drive_documents" ON public.drive_documents;
CREATE POLICY "admin_update_drive_documents"
  ON public.drive_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- DELETE: admin + super_admin
DROP POLICY IF EXISTS "super_admin_delete_drive_documents" ON public.drive_documents;
DROP POLICY IF EXISTS "admin_delete_drive_documents" ON public.drive_documents;
CREATE POLICY "admin_delete_drive_documents"
  ON public.drive_documents
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super());
