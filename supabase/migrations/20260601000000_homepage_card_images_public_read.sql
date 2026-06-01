-- Make homepage-card-images readable by anonymous homepage visitors.
-- The homepage (Hero "Today's Special" card, Announcement card) is public, so
-- anon users must be able to read these images. Previously the bucket was
-- private with an authenticated-only read policy, causing signed-URL requests
-- from anon visitors to fail with 400 / not_found.

-- 1. Mark the bucket public so getPublicUrl works without a signing round-trip.
UPDATE storage.buckets
SET public = true
WHERE id = 'homepage-card-images';

-- 2. Allow anyone (anon + authenticated) to read objects in this bucket.
DROP POLICY IF EXISTS "authenticated_can_read_homepage_card_images" ON storage.objects;
DROP POLICY IF EXISTS "public_can_read_homepage_card_images" ON storage.objects;
CREATE POLICY "public_can_read_homepage_card_images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'homepage-card-images');
