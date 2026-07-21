-- Additive only, mirrors the guest_carts pattern: scoped SECURITY DEFINER
-- lookups that take the identifying value as an explicit argument, so a
-- caller can never omit the filter and dump the whole table. Old wide-open
-- anon SELECT policies on vouchers/discount_vouchers/orders are dropped in
-- a follow-up migration once the front end (this repo) is confirmed live
-- with the RPC-based calls.

create or replace function public.lookup_voucher_by_code(p_voucher_code text)
returns table (
  voucher_code text,
  customer_name text,
  customer_email text,
  customer_phone text,
  total_meals integer,
  meals_remaining integer,
  status voucher_status,
  package_type text
)
language sql
security definer
set search_path = public
as $$
  select voucher_code, customer_name, customer_email, customer_phone,
         total_meals, meals_remaining, status, package_type
  from public.vouchers
  where voucher_code = p_voucher_code;
$$;

create or replace function public.lookup_discount_voucher_by_code(p_dv_code text)
returns table (
  id uuid,
  dv_code text,
  dv_amount numeric,
  status discount_voucher_status,
  expiry_date date,
  times_used integer
)
language sql
security definer
set search_path = public
as $$
  select id, dv_code, dv_amount, status, expiry_date, times_used
  from public.discount_vouchers
  where dv_code = p_dv_code;
$$;

create or replace function public.get_orders_by_email(p_email text)
returns setof public.orders
language sql
security definer
set search_path = public
as $$
  select * from public.orders
  where customer_email = p_email
  order by created_at desc;
$$;

grant execute on function public.lookup_voucher_by_code(text) to anon, authenticated;
grant execute on function public.lookup_discount_voucher_by_code(text) to anon, authenticated;
grant execute on function public.get_orders_by_email(text) to anon, authenticated;
