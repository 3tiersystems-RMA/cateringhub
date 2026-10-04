-- Gallery Images table for homepage gallery section
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_path TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_sort_order ON public.gallery_images(sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_images_is_visible ON public.gallery_images(is_visible);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- Public can read gallery images
DROP POLICY IF EXISTS "public_read_gallery_images" ON public.gallery_images;
CREATE POLICY "public_read_gallery_images"
  ON public.gallery_images
  FOR SELECT
  TO public
  USING (true);

-- Authenticated staff can manage gallery images
DROP POLICY IF EXISTS "staff_manage_gallery_images" ON public.gallery_images;
CREATE POLICY "staff_manage_gallery_images"
  ON public.gallery_images
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Gallery section visibility settings
CREATE TABLE IF NOT EXISTS public.gallery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_visible BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.gallery_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_gallery_settings" ON public.gallery_settings;
CREATE POLICY "public_read_gallery_settings"
  ON public.gallery_settings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "staff_manage_gallery_settings" ON public.gallery_settings;
CREATE POLICY "staff_manage_gallery_settings"
  ON public.gallery_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default gallery settings row
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gallery_settings LIMIT 1) THEN
    INSERT INTO public.gallery_settings (section_visible) VALUES (true);
  END IF;
END $$;

-- Create gallery-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-images',
  'gallery-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for gallery-images bucket
DROP POLICY IF EXISTS "gallery_images_public_read" ON storage.objects;
CREATE POLICY "gallery_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'gallery-images');

DROP POLICY IF EXISTS "gallery_images_staff_upload" ON storage.objects;
CREATE POLICY "gallery_images_staff_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery-images');

DROP POLICY IF EXISTS "gallery_images_staff_update" ON storage.objects;
CREATE POLICY "gallery_images_staff_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery-images');

DROP POLICY IF EXISTS "gallery_images_staff_delete" ON storage.objects;
CREATE POLICY "gallery_images_staff_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery-images');
