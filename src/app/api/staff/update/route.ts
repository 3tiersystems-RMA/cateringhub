import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api/staff-auth';
import { getSupabaseAdmin } from '@/lib/api/supabase-admin';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = String(body.id || '').trim();
    const full_name = String(body.full_name || '').trim();
    const phone = String(body.phone || '').trim();
    const role = body.role;

    if (!id || !full_name) {
      return NextResponse.json({ error: 'ID and name are required.' }, { status: 400 });
    }

    if (!['admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin or staff.' }, { status: 400 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: 'Server configuration error: service role key missing.' },
        { status: 500 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    if (existing.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot edit a super admin account.' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        full_name,
        phone: phone || null,
        role,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { full_name, role },
    });

    return NextResponse.json({ success: true, message: 'Staff member updated.' });
  } catch (err: unknown) {
    console.error('Update staff error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
