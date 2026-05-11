-- Weekly Menu table
CREATE TABLE IF NOT EXISTS public.weekly_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date DATE NOT NULL,
  day_name TEXT NOT NULL,
  meal_name TEXT,
  description TEXT,
  price NUMERIC(10, 2),
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weekly_menu_meal_date ON public.weekly_menu(meal_date);

ALTER TABLE public.weekly_menu ENABLE ROW LEVEL SECURITY;

-- Public can read weekly menu
DROP POLICY IF EXISTS "public_read_weekly_menu" ON public.weekly_menu;
CREATE POLICY "public_read_weekly_menu"
  ON public.weekly_menu
  FOR SELECT
  TO public
  USING (true);

-- Authenticated staff can manage weekly menu
DROP POLICY IF EXISTS "staff_manage_weekly_menu" ON public.weekly_menu;
CREATE POLICY "staff_manage_weekly_menu"
  ON public.weekly_menu
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed data for week of 16-20 March 2026
DO $$
BEGIN
  -- Only insert if no data exists for this week
  IF NOT EXISTS (
    SELECT 1 FROM public.weekly_menu
    WHERE meal_date BETWEEN '2026-03-16' AND '2026-03-20'
  ) THEN
    INSERT INTO public.weekly_menu (meal_date, day_name, meal_name, description, price, is_closed, closed_reason)
    VALUES
      ('2026-03-16', 'MON', 'Prawn Orzotto', 'Creamy rice pasta', 240.00, false, NULL),
      ('2026-03-17', 'TUE', 'Chicken Schnitzel & Mushroom Sauce', 'Hasselback potatoes & grilled veg', 220.00, false, NULL),
      ('2026-03-18', 'WED', 'Cottage Pie', 'Sweet yellow rice & filled gem squash', 230.00, false, NULL),
      ('2026-03-19', 'THU', 'Madras Chicken Curry', 'Roast potato & butter rice', 220.00, false, NULL),
      ('2026-03-20', 'FRI', NULL, NULL, NULL, true, 'Closed for the day of Eid');
  END IF;
END $$;
