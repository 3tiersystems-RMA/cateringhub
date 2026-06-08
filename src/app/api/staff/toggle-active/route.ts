import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api/staff-auth';
import { getSupabaseAdmin } from '@/lib/api/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = String(body.id || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'Staff member ID is required.' }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account.' },
        { status: 403 }
      );
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

    const { data: member, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, is_active, role')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !member) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    if (member.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot change super admin status.' }, { status: 403 });
    }

    const nextActive = !member.is_active;

    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ is_active: nextActive })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_active: nextActive,
      message: nextActive ? 'Staff member activated.' : 'Staff member deactivated.',
    });
  } catch (err: unknown) {
    console.error('Toggle staff active error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
