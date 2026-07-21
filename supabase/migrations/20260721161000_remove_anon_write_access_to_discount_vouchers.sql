-- No legitimate client-side flow needs to directly rewrite a discount
-- voucher's amount/status/usage count. Anon read stays (needed to validate
-- a code at checkout); this only removes anon's ability to WRITE to the
-- table, closing a live discount/revenue fraud vector.
drop policy if exists anon_update_discount_vouchers on public.discount_vouchers;
