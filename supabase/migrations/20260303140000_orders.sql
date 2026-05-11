-- Orders Migration
-- Creates orders table for PayFast payment tracking and fulfillment management

-- 1. Types
DROP TYPE IF EXISTS public.payment_status CASCADE;
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed');

DROP TYPE IF EXISTS public.fulfillment_status CASCADE;
CREATE TYPE public.fulfillment_status AS ENUM ('new', 'confirmed', 'preparing', 'ready', 'delivered');

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payfast_transaction_id TEXT,
    m_payment_id TEXT UNIQUE,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    customer_phone TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_status public.payment_status NOT NULL DEFAULT 'pending'::public.payment_status,
    fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'new'::public.fulfillment_status,
    event_date DATE,
    delivery_address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_m_payment_id ON public.orders(m_payment_id);

-- 4. Updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Staff can read all orders
DROP POLICY IF EXISTS "staff_read_all_orders" ON public.orders;
CREATE POLICY "staff_read_all_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_staff_member());

-- Staff can update orders (fulfillment status)
DROP POLICY IF EXISTS "staff_update_orders" ON public.orders;
CREATE POLICY "staff_update_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_staff_member())
WITH CHECK (public.is_staff_member());

-- Allow insert from service_role (used by webhook via Supabase service key)
-- The ITN webhook uses the service role key to bypass RLS
DROP POLICY IF EXISTS "service_role_insert_orders" ON public.orders;
CREATE POLICY "service_role_insert_orders"
ON public.orders
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow anon insert for webhook (ITN route uses anon key in server context)
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
CREATE POLICY "anon_insert_orders"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (true);
