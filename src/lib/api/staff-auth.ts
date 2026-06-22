import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STAFF_ROLES = ['staff', 'admin', 'super_admin'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/** Require an authenticated staff workspace user for API routes. */
export async function requireStaffMember() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized — staff login required' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.role || !STAFF_ROLES.includes(profile.role as StaffRole)) {
    return {
      error: NextResponse.json({ error: 'Forbidden — staff access only' }, { status: 403 }),
    };
  }

  return { user, role: profile.role as StaffRole, supabase };
}

/** Require admin or super_admin for sensitive admin-only APIs. */
export async function requireAdminOrAbove() {
  const result = await requireStaffMember();
  if ('error' in result) return result;

  if (result.role !== 'admin' && result.role !== 'super_admin') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — admin access required' },
        { status: 403 }
      ),
    };
  }

  return result;
}

/** Require super_admin for staff-management APIs (invite, promote, etc.). */
export async function requireSuperAdmin() {
  const result = await requireStaffMember();
  if ('error' in result) return result;

  if (result.role !== 'super_admin') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — super admin access required' },
        { status: 403 }
      ),
    };
  }

  return result;
}
