-- Homepage Cards Migration
-- Creates the homepage_cards table for parameter-driven hero card management

-- 1. ENUM type for card_type
DROP TYPE IF EXISTS public.homepage_card_type CASCADE;
CREATE TYPE public.homepage_card_type AS ENUM ('todays_special', 'next_booking', 'customer_review');

-- 2. Table
CREATE TABLE IF NOT EXISTS public.homepage_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_type public.homepage_card_type NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  description TEXT,
  price NUMERIC(10,2),
  price_unit TEXT,
  badge_label TEXT,
  event_date TEXT,
  guest_count INTEGER,
  prep_percentage INTEGER CHECK (prep_percentage >= 0 AND prep_percentage <= 100),
  reviewer_name TEXT,
  reviewer_event TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_homepage_cards_display_order ON public.homepage_cards(display_order);
CREATE INDEX IF NOT EXISTS idx_homepage_cards_is_visible ON public.homepage_cards(is_visible);

-- 4. updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_homepage_cards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.homepage_cards ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Public can SELECT visible cards
DROP POLICY IF EXISTS "public_can_read_visible_homepage_cards" ON public.homepage_cards;
CREATE POLICY "public_can_read_visible_homepage_cards"
ON public.homepage_cards
FOR SELECT
TO public
USING (is_visible = true);

-- Authenticated staff can do ALL operations
DROP POLICY IF EXISTS "staff_can_manage_homepage_cards" ON public.homepage_cards;
CREATE POLICY "staff_can_manage_homepage_cards"
ON public.homepage_cards
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Trigger
DROP TRIGGER IF EXISTS homepage_cards_updated_at ON public.homepage_cards;
CREATE TRIGGER homepage_cards_updated_at
  BEFORE UPDATE ON public.homepage_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_homepage_cards_updated_at();

-- 8. Seed data — the 3 current hardcoded hero cards
DO $$
BEGIN
  -- Only seed if table is empty
  IF NOT EXISTS (SELECT 1 FROM public.homepage_cards LIMIT 1) THEN

    -- Card 1: Today's Special
    INSERT INTO public.homepage_cards (
      card_type, title, price, price_unit, badge_label, is_visible, display_order
    ) VALUES (
      'todays_special'::public.homepage_card_type,
      'Pan-Seared Salmon',
      28.00,
      'serving',
      'Limited',
      true,
      1
    );

    -- Card 2: Next Booking
    INSERT INTO public.homepage_cards (
      card_type, title, event_date, guest_count, prep_percentage, is_visible, display_order
    ) VALUES (
      'next_booking'::public.homepage_card_type,
      'Corporate Lunch',
      'Feb 24',
      80,
      75,
      true,
      2
    );

    -- Card 3: Customer Review
    INSERT INTO public.homepage_cards (
      card_type, description, rating, reviewer_name, reviewer_event, is_visible, display_order
    ) VALUES (
      'customer_review'::public.homepage_card_type,
      'The food was absolutely stunning — every guest asked for the recipes!',
      5,
      'Sarah M.',
      'Wedding',
      true,
      3
    );

  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
