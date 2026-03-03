-- Backfill user_profiles for existing auth users
-- This fixes the RLS UPDATE block on products table:
-- is_staff_member() returns false when user_profiles row is missing
-- (happens when user was created BEFORE the handle_new_user trigger existed)

-- Step 1: Insert missing user_profiles rows for all existing auth users
INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    'staff'::public.staff_role,
    true
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles up WHERE up.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Ensure all existing profiles have is_active = true
-- (in case any were accidentally set to false)
UPDATE public.user_profiles
SET is_active = true
WHERE is_active = false;

-- Step 3: Verify - run this SELECT to confirm your user has a profile
-- SELECT id, email, role, is_active FROM public.user_profiles;
