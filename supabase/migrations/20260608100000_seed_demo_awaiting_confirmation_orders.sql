-- Demo orders for Payment Confirmation workspace tab (idempotent by m_payment_id).
-- Safe to run multiple times; skips if reference already exists.

INSERT INTO public.orders (
  m_payment_id,
  customer_name,
  customer_email,
  customer_phone,
  items,
  subtotal,
  delivery_fee,
  total,
  payment_status,
  fulfillment_status,
  payment_method,
  payfast_transaction_id,
  delivery_address,
  notes
)
SELECT
  'DEMO-PF-20260608-001',
  'Sarah van der Merwe',
  'sarah.demo@example.com',
  '0821234567',
  '[{"id": "502e631b-30de-4807-9612-c3aadfe0febb", "name": "Butterfly Blossom", "quantity": 2, "price": 180, "unit": "per serving", "category": "Catering Packages"}]'::jsonb,
  360,
  85,
  445,
  'awaiting_confirmation'::public.payment_status,
  'new'::public.fulfillment_status,
  'payfast',
  'PF-DEMO-1001',
  '45 Main Road, Cape Town, 8001',
  'Demo order — PayFast payment received, awaiting customer confirmation email'
WHERE NOT EXISTS (
  SELECT 1 FROM public.orders WHERE m_payment_id = 'DEMO-PF-20260608-001'
);

INSERT INTO public.orders (
  m_payment_id,
  customer_name,
  customer_email,
  customer_phone,
  items,
  subtotal,
  delivery_fee,
  total,
  payment_status,
  fulfillment_status,
  payment_method,
  delivery_address,
  notes
)
SELECT
  'DEMO-EFT-20260608-002',
  'James Naidoo',
  'james.demo@example.com',
  '0839876543',
  '[{"id": "406c5555-f7a7-45ab-afbb-d5e250baa972", "name": "Herb-Roasted Chicken & Vegetables", "quantity": 10, "price": 14, "unit": "per serving", "category": "Prepared Meals"}]'::jsonb,
  140,
  50,
  190,
  'awaiting_confirmation'::public.payment_status,
  'new'::public.fulfillment_status,
  'eft',
  '12 Cardamom Street, Cape Town, 7441',
  'Demo order — EFT received in bank, queued for confirmation email'
WHERE NOT EXISTS (
  SELECT 1 FROM public.orders WHERE m_payment_id = 'DEMO-EFT-20260608-002'
);
