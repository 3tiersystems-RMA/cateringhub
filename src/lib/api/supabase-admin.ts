import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAuthUserById(
  admin: SupabaseClient,
  userId: string
): Promise<User | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Resolve an auth user by email using every reliable source:
 * 1. user_profiles (staff list / invited users)
 * 2. auth.users via RPC (exact email match)
 * 3. paginated listUsers fallback
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id')
    .ilike('email', normalized)
    .maybeSingle();

  if (profile?.id) {
    const user = await getAuthUserById(admin, profile.id);
    if (user) return user;
  }

  try {
    const { data: userId, error: rpcError } = await admin.rpc(
      'lookup_auth_user_id_by_email',
      { lookup_email: normalized }
    );

    if (!rpcError && userId) {
      const user = await getAuthUserById(admin, String(userId));
      if (user) return user;
    }
  } catch {
    // RPC may not be deployed yet — fall through to listUsers
  }

  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (user) return user;

    if (data.users.length < perPage) break;
    page++;
  }

  return null;
}

/** Load staff profile row by email (case-insensitive). */
export async function findProfileByEmail(admin: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  const { data } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active, full_name, phone')
    .ilike('email', normalized)
    .maybeSingle();
  return data;
}
