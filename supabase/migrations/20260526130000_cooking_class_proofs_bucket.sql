-- Create the cooking-class-proofs storage bucket for proof of payment uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cooking-class-proofs',
  'cooking-class-proofs',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone (public) to upload proof of payment files (unauthenticated registrants)
DROP POLICY IF EXISTS "cooking_class_proofs_public_insert" ON storage.objects;
CREATE POLICY "cooking_class_proofs_public_insert"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'cooking-class-proofs');

-- Allow authenticated staff to read proof of payment files
DROP POLICY IF EXISTS "cooking_class_proofs_staff_select" ON storage.objects;
CREATE POLICY "cooking_class_proofs_staff_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cooking-class-proofs');

-- Allow authenticated staff to delete proof of payment files
DROP POLICY IF EXISTS "cooking_class_proofs_staff_delete" ON storage.objects;
CREATE POLICY "cooking_class_proofs_staff_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cooking-class-proofs');
