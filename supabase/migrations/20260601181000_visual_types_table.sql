-- Create visual_types lookup table
CREATE TABLE IF NOT EXISTS public.visual_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.visual_types ENABLE ROW LEVEL SECURITY;

-- Public read access (staff and customers can read)
DROP POLICY IF EXISTS "public_read_visual_types" ON public.visual_types;
CREATE POLICY "public_read_visual_types"
  ON public.visual_types
  FOR SELECT
  TO public
  USING (true);

-- Only authenticated staff can manage
DROP POLICY IF EXISTS "authenticated_manage_visual_types" ON public.visual_types;
CREATE POLICY "authenticated_manage_visual_types"
  ON public.visual_types
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed with Macro and Micro
INSERT INTO public.visual_types (name) VALUES
  ('Macro'),
  ('Micro')
ON CONFLICT (name) DO NOTHING;
