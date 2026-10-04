-- Ensure cooking_classes is a readable view alias for cooking_class_name.
-- The rename migration (20260615100000) expected cooking_class_events to exist,
-- but the actual table was always cooking_class_name. This migration creates the
-- view alias so both names resolve correctly.

DO $$
BEGIN
  -- Drop the old view if it was created pointing to a non-existent cooking_classes table
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'cooking_classes'
  ) THEN
    DROP VIEW public.cooking_classes;
  END IF;
END $$;

-- Create cooking_classes as a view over cooking_class_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'cooking_classes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_classes'
  ) THEN
    CREATE VIEW public.cooking_classes AS
      SELECT * FROM public.cooking_class_name;
  END IF;
END $$;

COMMENT ON VIEW public.cooking_classes IS
  'Compatibility alias for cooking_class_name. Use cooking_class_name directly in new code.';
