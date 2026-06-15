-- Rename cooking_classes → cooking_class_name
-- cooking_class_sessions.class_id FK is automatically updated (same physical table, just renamed)

DO $$
BEGIN
  -- Rename cooking_classes → cooking_class_name (if not already done)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_classes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_name'
  ) THEN
    ALTER TABLE public.cooking_classes RENAME TO cooking_class_name;
  END IF;
END $$;

-- Drop the old compatibility view for cooking_class_events (points to cooking_classes which no longer exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'cooking_class_events'
  ) THEN
    DROP VIEW public.cooking_class_events;
  END IF;
END $$;

-- Recreate the cooking_class_events compatibility view pointing to cooking_class_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_name'
  ) THEN
    CREATE OR REPLACE VIEW public.cooking_class_events AS
      SELECT * FROM public.cooking_class_name;
  END IF;
END $$;

-- Update table comment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_name'
  ) THEN
    COMMENT ON TABLE public.cooking_class_name IS
      'In-person cooking & baking class types (e.g. Kids Class, Adults Class). Not marketing events.';
  END IF;
END $$;

-- Ensure RLS policies exist on the renamed table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_name'
  ) THEN
    ALTER TABLE public.cooking_class_name ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "public_read_cooking_class_name" ON public.cooking_class_name;
CREATE POLICY "public_read_cooking_class_name"
ON public.cooking_class_name FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_cooking_class_name" ON public.cooking_class_name;
CREATE POLICY "authenticated_manage_cooking_class_name"
ON public.cooking_class_name FOR ALL TO authenticated USING (true) WITH CHECK (true);
