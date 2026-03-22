-- Drive Documents table for Document Management
CREATE TABLE IF NOT EXISTS public.drive_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id       TEXT NOT NULL,
  file_type     TEXT NOT NULL DEFAULT 'other',
  embed_url     TEXT NOT NULL,
  original_url  TEXT NOT NULL,
  title         TEXT NOT NULL,
  folder_name   TEXT NOT NULL DEFAULT 'General',
  created_time  TEXT,
  modified_time TEXT,
  added_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_documents_file_id ON public.drive_documents(file_id);
CREATE INDEX IF NOT EXISTS idx_drive_documents_folder ON public.drive_documents(folder_name);

-- Helper function: check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

ALTER TABLE public.drive_documents ENABLE ROW LEVEL SECURITY;

-- All authenticated staff can read documents
DROP POLICY IF EXISTS "staff_read_drive_documents" ON public.drive_documents;
CREATE POLICY "staff_read_drive_documents"
  ON public.drive_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin can insert
DROP POLICY IF EXISTS "super_admin_insert_drive_documents" ON public.drive_documents;
CREATE POLICY "super_admin_insert_drive_documents"
  ON public.drive_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

-- Only super_admin can update
DROP POLICY IF EXISTS "super_admin_update_drive_documents" ON public.drive_documents;
CREATE POLICY "super_admin_update_drive_documents"
  ON public.drive_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Only super_admin can delete
DROP POLICY IF EXISTS "super_admin_delete_drive_documents" ON public.drive_documents;
CREATE POLICY "super_admin_delete_drive_documents"
  ON public.drive_documents
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());
