import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api/staff-auth';
import { getSupabaseAdmin } from '@/lib/api/supabase-admin';

export async function DELETE(request: NextRequest) {
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
        { error: 'You cannot delete your own account.' },
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
      .select('id, is_active, role, full_name')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !member) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    if (member.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete a super admin account.' }, { status: 403 });
    }

    if (member.is_active) {
      return NextResponse.json(
        { error: 'Deactivate this staff member before deleting them.' },
        { status: 400 }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (profileDeleteError) {
      return NextResponse.json({ error: profileDeleteError.message }, { status: 500 });
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authDeleteError) {
      console.warn('Auth user delete warning:', authDeleteError.message);
    }

    return NextResponse.json({
      success: true,
      message: `${member.full_name} has been deleted.`,
    });
  } catch (err: unknown) {
    console.error('Delete staff error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
