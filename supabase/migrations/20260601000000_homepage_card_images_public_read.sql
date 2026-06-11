-- Make homepage-card-images readable by anonymous homepage visitors.
-- The homepage (Hero "Today's Special" card, Announcement card) is public, so
-- anon users must be able to read these images. Previously the bucket was
-- private with an authenticated-only read policy, causing getPublicUrl links
-- to fail for visitors who are not logged in.

-- 1. Ensure the bucket exists and is public (idempotent for fresh + prod deploys).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homepage-card-images',
  'homepage-card-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Allow anyone (anon + authenticated) to read objects in this bucket.
DROP POLICY IF EXISTS "authenticated_can_read_homepage_card_images" ON storage.objects;
DROP POLICY IF EXISTS "public_can_read_homepage_card_images" ON storage.objects;
CREATE POLICY "public_can_read_homepage_card_images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'homepage-card-images');
