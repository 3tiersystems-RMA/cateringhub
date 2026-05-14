-- Add image_path column to homepage_cards for Today's Special card image management
-- Also creates the homepage-card-images storage bucket

-- 1. Add image_path column to homepage_cards
ALTER TABLE public.homepage_cards
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- 2. Create storage bucket for homepage card images (if not exists via SQL)
-- Note: bucket creation is handled via Supabase dashboard or API; 
-- we add storage policies assuming the bucket 'homepage-card-images' exists.
-- The bucket will be created programmatically on first upload if needed.
-- Storage RLS policies for homepage-card-images bucket
DO $$
BEGIN
  -- Insert bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'homepage-card-images',
    'homepage-card-images',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Bucket creation skipped: %', SQLERRM;
END $$;

-- Storage policies for homepage-card-images
DROP POLICY IF EXISTS "authenticated_can_upload_homepage_card_images" ON storage.objects;
CREATE POLICY "authenticated_can_upload_homepage_card_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'homepage-card-images');

DROP POLICY IF EXISTS "authenticated_can_update_homepage_card_images" ON storage.objects;
CREATE POLICY "authenticated_can_update_homepage_card_images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'homepage-card-images');

DROP POLICY IF EXISTS "authenticated_can_delete_homepage_card_images" ON storage.objects;
CREATE POLICY "authenticated_can_delete_homepage_card_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'homepage-card-images');

DROP POLICY IF EXISTS "authenticated_can_read_homepage_card_images" ON storage.objects;
CREATE POLICY "authenticated_can_read_homepage_card_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'homepage-card-images');
