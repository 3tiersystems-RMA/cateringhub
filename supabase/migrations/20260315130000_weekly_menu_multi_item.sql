-- Weekly Menu: Multi-item per day support
-- The existing weekly_menu table already supports multiple rows per meal_date.
-- This migration removes the old single-item seed data and ensures the table
-- is clean for staff to load full weekly menus with multiple items per day.

-- Remove old seed data (single-item-per-day pattern from previous migration)
DELETE FROM public.weekly_menu
WHERE meal_date BETWEEN '2026-03-16' AND '2026-03-20';

-- Ensure the index exists for efficient date-range queries
CREATE INDEX IF NOT EXISTS idx_weekly_menu_meal_date ON public.weekly_menu(meal_date);

-- Ensure RLS policies are in place
ALTER TABLE public.weekly_menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_weekly_menu" ON public.weekly_menu;
CREATE POLICY "public_read_weekly_menu"
  ON public.weekly_menu
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "staff_manage_weekly_menu" ON public.weekly_menu;
CREATE POLICY "staff_manage_weekly_menu"
  ON public.weekly_menu
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
