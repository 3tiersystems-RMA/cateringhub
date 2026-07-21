-- Secure, token-scoped access to guest_carts via SECURITY DEFINER RPCs.
-- Additive only: existing guest_carts_public_* policies are left untouched
-- for now so nothing in the current app breaks. These functions are the
-- intended replacement path once the front end is updated to call them
-- instead of querying public.guest_carts directly.

create or replace function public.get_guest_cart_by_token(p_guest_token text)
returns setof public.guest_carts
language sql
security definer
set search_path = public
as $$
  select * from public.guest_carts where guest_token = p_guest_token;
$$;

create or replace function public.upsert_guest_cart_by_token(
  p_guest_token text,
  p_items jsonb,
  p_customer_email text default null,
  p_customer_name text default null
)
returns public.guest_carts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.guest_carts;
begin
  insert into public.guest_carts (guest_token, items, customer_email, customer_name, last_activity_at, created_at, updated_at)
  values (p_guest_token, p_items, p_customer_email, p_customer_name, now(), now(), now())
  on conflict (guest_token) do update
    set items = excluded.items,
        customer_email = coalesce(excluded.customer_email, guest_carts.customer_email),
        customer_name = coalesce(excluded.customer_name, guest_carts.customer_name),
        last_activity_at = now(),
        updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_guest_cart_by_token(p_guest_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.guest_carts where guest_token = p_guest_token;
$$;

grant execute on function public.get_guest_cart_by_token(text) to anon, authenticated;
grant execute on function public.upsert_guest_cart_by_token(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.delete_guest_cart_by_token(text) to anon, authenticated;
