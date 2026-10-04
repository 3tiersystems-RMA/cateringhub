-- Reseed homepage_cards with all 4 card types (idempotent)
-- Uses ON CONFLICT on card_type to avoid duplicates

-- Ensure the announcement enum value exists (safe to run even if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'announcement'
      AND enumtypid = (
        SELECT oid FROM pg_type
        WHERE typname = 'homepage_card_type'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.homepage_card_type ADD VALUE 'announcement';
  END IF;
END $$;

-- Add image_url column if not present
ALTER TABLE public.homepage_cards
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a unique constraint on card_type so ON CONFLICT works
-- (safe to run multiple times — ignored if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homepage_cards_card_type_key'
      AND conrelid = 'public.homepage_cards'::regclass
  ) THEN
    ALTER TABLE public.homepage_cards
    ADD CONSTRAINT homepage_cards_card_type_key UNIQUE (card_type);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint already exists or could not be added: %', SQLERRM;
END $$;

-- Seed all 4 cards — insert if missing, do nothing if already present
INSERT INTO public.homepage_cards (card_type, title, price, price_unit, badge_label, is_visible, display_order)
VALUES ('todays_special'::public.homepage_card_type, 'Pan-Seared Salmon', 28.00, 'serving', 'Limited', true, 1)
ON CONFLICT (card_type) DO NOTHING;

INSERT INTO public.homepage_cards (card_type, title, event_date, guest_count, prep_percentage, is_visible, display_order)
VALUES ('next_booking'::public.homepage_card_type, 'Corporate Lunch', 'Feb 24', 80, 75, true, 2)
ON CONFLICT (card_type) DO NOTHING;

INSERT INTO public.homepage_cards (card_type, description, rating, reviewer_name, reviewer_event, is_visible, display_order)
VALUES ('customer_review'::public.homepage_card_type, 'The food was absolutely stunning — every guest asked for the recipes!', 5, 'Sarah M.', 'Wedding', true, 3)
ON CONFLICT (card_type) DO NOTHING;

INSERT INTO public.homepage_cards (card_type, title, description, is_visible, display_order)
VALUES ('announcement'::public.homepage_card_type, 'Announcement', 'Add your announcement details here.', false, 4)
ON CONFLICT (card_type) DO NOTHING;
