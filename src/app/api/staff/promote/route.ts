import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, full_name, phone_number, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required.' }, { status: 400 });
    }

    if (!['admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin or staff.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if already a staff/admin member
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, role')
      .eq('email', email)
      .in('role', ['staff', 'admin', 'super_admin'])
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `This user is already a staff member (${existingProfile.role}).` },
        { status: 409 }
      );
    }

    // Find the user in Supabase Auth by email
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: 'Failed to look up users.' }, { status: 500 });
    }

    const authUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!authUser) {
      return NextResponse.json(
        { error: 'No Supabase account found for this email. Use "Send Invite" to create a new staff account.' },
        { status: 404 }
      );
    }

    // Upsert the user_profiles row with the staff role
    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: authUser.id,
          email: authUser.email,
          full_name: full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '',
          phone: phone_number || authUser.phone || '',
          role,
          is_active: true,
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${authUser.email} has been promoted to ${role}. They can log in with their existing credentials.`,
    });
  } catch (err: any) {
    console.error('Promote staff error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
