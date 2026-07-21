-- Verified against the app source (github.com/3tiersystems-RMA/cateringhub):
-- none of these tables/policies are referenced anywhere in src/. Safe to
-- close outright, zero functional impact.

-- guest_carts: "guest_cart" does not appear anywhere in the app source.
-- The RPCs added in 20260721160000 remain in place for if/when real
-- guest-cart persistence is built; the old open table policies serve no
-- purpose today.
drop policy if exists guest_carts_public_select on public.guest_carts;
drop policy if exists guest_carts_public_update on public.guest_carts;
drop policy if exists guest_carts_public_delete on public.guest_carts;
drop policy if exists guest_carts_public_insert on public.guest_carts;

-- voucher_redemptions: app only INSERTs (checkout flow), never SELECTs as anon.
drop policy if exists anon_read_redemptions on public.voucher_redemptions;

-- customer_credits / customer_credit_transactions: no references anywhere
-- in the app source. Entirely unused, publicly readable PII/financial data.
drop policy if exists public_read_credits_by_email on public.customer_credits;
drop policy if exists public_read_credit_transactions on public.customer_credit_transactions;
