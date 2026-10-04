-- Add 'announcement' card type to homepage_cards
-- Adds image_url column for URL-based images on announcement cards

-- 1. Add 'announcement' value to the existing enum
-- PostgreSQL allows ALTER TYPE ... ADD VALUE (idempotent-safe with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'announcement'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'homepage_card_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.homepage_card_type ADD VALUE 'announcement';
  END IF;
END $$;

-- 2. Add image_url column for URL-based images (announcement card)
ALTER TABLE public.homepage_cards
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Seed the announcement card (only if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.homepage_cards WHERE card_type = 'announcement'::public.homepage_card_type
  ) THEN
    INSERT INTO public.homepage_cards (
      card_type, title, description, is_visible, display_order
    ) VALUES (
      'announcement'::public.homepage_card_type,
      'Announcement',
      'Add your announcement details here.',
      false,
      4
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Announcement card seed skipped: %', SQLERRM;
END $$;
