-- Staff Workspace Migration
-- Creates user_profiles with staff role, storage buckets for product/event images

-- 1. Types
DROP TYPE IF EXISTS public.staff_role CASCADE;
CREATE TYPE public.staff_role AS ENUM ('admin', 'staff');

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    role public.staff_role DEFAULT 'staff'::public.staff_role,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 4. Functions (BEFORE RLS policies)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.staff_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('admin', 'staff')
    )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "staff_view_all_profiles" ON public.user_profiles;
CREATE POLICY "staff_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.is_staff_member());

-- 7. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. Storage Buckets (via SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('product-images', 'product-images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[]),
    ('event-photos', 'event-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[])
ON CONFLICT (id) DO NOTHING;

-- 9. Storage RLS Policies
DROP POLICY IF EXISTS "staff_upload_product_images" ON storage.objects;
CREATE POLICY "staff_upload_product_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_view_product_images" ON storage.objects;
CREATE POLICY "staff_view_product_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_delete_product_images" ON storage.objects;
CREATE POLICY "staff_delete_product_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_update_product_images" ON storage.objects;
CREATE POLICY "staff_update_product_images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.is_staff_member()
)
WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_upload_event_photos" ON storage.objects;
CREATE POLICY "staff_upload_event_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'event-photos'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_view_event_photos" ON storage.objects;
CREATE POLICY "staff_view_event_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'event-photos'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_delete_event_photos" ON storage.objects;
CREATE POLICY "staff_delete_event_photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'event-photos'
    AND public.is_staff_member()
);

DROP POLICY IF EXISTS "staff_update_event_photos" ON storage.objects;
CREATE POLICY "staff_update_event_photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'event-photos'
    AND public.is_staff_member()
)
WITH CHECK (
    bucket_id = 'event-photos'
    AND public.is_staff_member()
);

-- 10. Mock Staff User
DO $$
DECLARE
    staff_uuid UUID := gen_random_uuid();
BEGIN
    -- Insert into auth.users using only the core columns that exist in all Supabase versions
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_user_meta_data,
        raw_app_meta_data,
        is_sso_user,
        is_anonymous
    ) VALUES (
        staff_uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'staff@cateringhub.com',
        crypt('Staff@2024!', gen_salt('bf', 10)),
        now(),
        now(),
        now(),
        jsonb_build_object('full_name', 'CateringHub Staff', 'role', 'staff'),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        false,
        false
    )
    ON CONFLICT (email) DO NOTHING;

    -- Also insert the user_profile directly in case trigger doesn't fire
    INSERT INTO public.user_profiles (id, email, full_name, role)
    SELECT staff_uuid, 'staff@cateringhub.com', 'CateringHub Staff', 'staff'::public.staff_role
    WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@cateringhub.com')
    ON CONFLICT (email) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock user creation skipped: %', SQLERRM;
END $$;
