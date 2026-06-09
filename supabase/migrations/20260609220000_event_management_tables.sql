-- Event Management tables (mirrors cooking_class_* tables for a separate event booking system)

-- Settings
CREATE TABLE IF NOT EXISTS public.event_management_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_image_url text,
  flyer_image_path text,
  sheet_id text,
  sheet_name text DEFAULT 'Registrations',
  event_fee numeric(10,2) NOT NULL DEFAULT 0,
  online_form_status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_management_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_settings' AND policyname = 'staff_read_event_management_settings') THEN
    CREATE POLICY staff_read_event_management_settings ON public.event_management_settings FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_settings' AND policyname = 'staff_manage_event_management_settings') THEN
    CREATE POLICY staff_manage_event_management_settings ON public.event_management_settings FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
    );
  END IF;
END $$;

-- Events
CREATE TABLE IF NOT EXISTS public.event_management_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_management_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_events' AND policyname = 'public_read_event_management_events') THEN
    CREATE POLICY public_read_event_management_events ON public.event_management_events FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_events' AND policyname = 'staff_manage_event_management_events') THEN
    CREATE POLICY staff_manage_event_management_events ON public.event_management_events FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
    );
  END IF;
END $$;

-- Session statuses
CREATE TABLE IF NOT EXISTS public.event_management_session_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_management_session_statuses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_session_statuses' AND policyname = 'public_read_event_management_session_statuses') THEN
    CREATE POLICY public_read_event_management_session_statuses ON public.event_management_session_statuses FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_session_statuses' AND policyname = 'staff_manage_event_management_session_statuses') THEN
    CREATE POLICY staff_manage_event_management_session_statuses ON public.event_management_session_statuses FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
    );
  END IF;
END $$;

-- Event dates
CREATE TABLE IF NOT EXISTS public.event_management_event_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.event_management_events(id) ON DELETE CASCADE,
  event_date date,
  start_time time,
  end_time time,
  location text,
  sort_order integer NOT NULL DEFAULT 0,
  seating integer NOT NULL DEFAULT 0,
  status_id uuid REFERENCES public.event_management_session_statuses(id) ON DELETE SET NULL,
  event_fee numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_management_event_dates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_event_dates' AND policyname = 'public_read_event_management_event_dates') THEN
    CREATE POLICY public_read_event_management_event_dates ON public.event_management_event_dates FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_event_dates' AND policyname = 'staff_manage_event_management_event_dates') THEN
    CREATE POLICY staff_manage_event_management_event_dates ON public.event_management_event_dates FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
    );
  END IF;
END $$;

-- Registrations
CREATE TABLE IF NOT EXISTS public.event_management_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  first_name text NOT NULL,
  surname text NOT NULL,
  email text NOT NULL,
  cellphone text NOT NULL,
  selected_events text[] DEFAULT '{}',
  adult_class_dates text[] DEFAULT '{}',
  relationship text,
  first_time_portal text,
  allergies_illness text,
  rsa_id_passport text,
  emergency_contact1 jsonb,
  emergency_contact2 jsonb,
  medical_doctor_first_name text,
  medical_doctor_surname text,
  medical_aid_name text,
  medical_aid_number text,
  children jsonb DEFAULT '[]',
  attend_school_holiday text,
  pictures_taken text,
  indemnity_consent boolean,
  indemnity_file_url text,
  payment_method text NOT NULL DEFAULT 'eft',
  payment_status text NOT NULL DEFAULT 'pending',
  amount numeric(10,2),
  proof_of_payment_url text,
  proof_of_payment_path text,
  proof_of_payment_drive_url text,
  payfast_payment_id text,
  synced_to_sheet boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_management_registrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_registrations' AND policyname = 'public_insert_event_management_registrations') THEN
    CREATE POLICY public_insert_event_management_registrations ON public.event_management_registrations FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_registrations' AND policyname = 'staff_manage_event_management_registrations') THEN
    CREATE POLICY staff_manage_event_management_registrations ON public.event_management_registrations FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
    );
  END IF;
END $$;

-- Booking counts
CREATE TABLE IF NOT EXISTS public.event_management_booking_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.event_management_registrations(id) ON DELETE CASCADE,
  event_date_id uuid REFERENCES public.event_management_event_dates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_management_booking_counts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_booking_counts' AND policyname = 'public_insert_event_management_booking_counts') THEN
    CREATE POLICY public_insert_event_management_booking_counts ON public.event_management_booking_counts FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_management_booking_counts' AND policyname = 'staff_manage_event_management_booking_counts') THEN
    CREATE POLICY staff_manage_event_management_booking_counts ON public.event_management_booking_counts FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','super_admin','staff'))
    );
  END IF;
END $$;

-- Seed default settings row
INSERT INTO public.event_management_settings (event_fee, online_form_status)
SELECT 0, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.event_management_settings);
