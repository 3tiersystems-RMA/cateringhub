-- Organisation Details: entities, banking details, warehouses/sites, contacts

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.org_banking_details (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      UUID NOT NULL REFERENCES public.org_entities(id) ON DELETE CASCADE,
  bank_name      TEXT NOT NULL,
  account_name   TEXT NOT NULL,
  account_number TEXT NOT NULL,
  branch_code    TEXT NOT NULL,
  account_type   TEXT,
  reference      TEXT,
  is_default     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.org_warehouses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES public.org_entities(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  city         TEXT,
  province     TEXT,
  postal_code  TEXT,
  country      TEXT NOT NULL DEFAULT 'South Africa',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.org_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID NOT NULL REFERENCES public.org_entities(id) ON DELETE CASCADE,
  contact_name      TEXT NOT NULL,
  email             TEXT,
  office_number     TEXT,
  mobile_number     TEXT,
  office_is_default BOOLEAN NOT NULL DEFAULT false,
  mobile_is_default BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_banking_entity_id ON public.org_banking_details(entity_id);
CREATE INDEX IF NOT EXISTS idx_org_warehouses_entity_id ON public.org_warehouses(entity_id);
CREATE INDEX IF NOT EXISTS idx_org_contacts_entity_id ON public.org_contacts(entity_id);

-- ── 3. Helper function (role check via user_profiles) ─────────────────────────

CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'super_admin')
      AND up.is_active = true
  )
$$;

-- ── 4. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.org_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_banking_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contacts ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies ───────────────────────────────────────────────────────────

-- org_entities
DROP POLICY IF EXISTS "staff_admin_manage_org_entities" ON public.org_entities;
CREATE POLICY "staff_admin_manage_org_entities"
ON public.org_entities
FOR ALL
TO authenticated
USING (public.is_staff_admin())
WITH CHECK (public.is_staff_admin());

-- org_banking_details
DROP POLICY IF EXISTS "staff_admin_manage_org_banking" ON public.org_banking_details;
CREATE POLICY "staff_admin_manage_org_banking"
ON public.org_banking_details
FOR ALL
TO authenticated
USING (public.is_staff_admin())
WITH CHECK (public.is_staff_admin());

-- org_warehouses
DROP POLICY IF EXISTS "staff_admin_manage_org_warehouses" ON public.org_warehouses;
CREATE POLICY "staff_admin_manage_org_warehouses"
ON public.org_warehouses
FOR ALL
TO authenticated
USING (public.is_staff_admin())
WITH CHECK (public.is_staff_admin());

-- org_contacts
DROP POLICY IF EXISTS "staff_admin_manage_org_contacts" ON public.org_contacts;
CREATE POLICY "staff_admin_manage_org_contacts"
ON public.org_contacts
FOR ALL
TO authenticated
USING (public.is_staff_admin())
WITH CHECK (public.is_staff_admin());
