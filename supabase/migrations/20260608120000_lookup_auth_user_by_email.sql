-- Reliable email → auth.users id lookup for staff promote/invite flows.
-- listUsers() pagination can miss accounts on larger projects.

CREATE OR REPLACE FUNCTION public.lookup_auth_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim(lookup_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auth_user_id_by_email(text) TO service_role;
