-- Update admin@cardamomkitchen.co.za role to 'admin'
UPDATE public.user_profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@cardamomkitchen.co.za'
)
AND role != 'super_admin';
