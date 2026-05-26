-- Create the cooking-class-flyers storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cooking-class-flyers',
  'cooking-class-flyers',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
DROP POLICY IF EXISTS "cooking_class_flyers_public_read" ON storage.objects;
CREATE POLICY "cooking_class_flyers_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cooking-class-flyers');

DROP POLICY IF EXISTS "cooking_class_flyers_staff_upload" ON storage.objects;
CREATE POLICY "cooking_class_flyers_staff_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cooking-class-flyers');

DROP POLICY IF EXISTS "cooking_class_flyers_staff_update" ON storage.objects;
CREATE POLICY "cooking_class_flyers_staff_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cooking-class-flyers');

DROP POLICY IF EXISTS "cooking_class_flyers_staff_delete" ON storage.objects;
CREATE POLICY "cooking_class_flyers_staff_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cooking-class-flyers');
