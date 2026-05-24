import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, full_name, role } = await request.json();

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!['admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin or staff.' }, { status: 400 });
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if this email already exists as a staff/admin member in user_profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, role')
      .eq('email', email)
      .in('role', ['staff', 'admin'])
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: 'A staff member with this email already exists.' }, { status: 409 });
    }

    // Invite user via Supabase Auth (sends magic link email)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name,
        role,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://cardamomkitchen.co.za'}/auth/callback`,
    });

    if (error) {
      // If user already exists in auth (e.g. existing customer), look them up and upsert profile
      if (error.message?.includes('already been registered')) {
        // Find the existing auth user by email
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (existingAuthUser) {
          // Upsert their profile with the new staff role
          await supabaseAdmin
            .from('user_profiles')
            .upsert({
              id: existingAuthUser.id,
              email,
              full_name,
              role,
              is_active: true,
            }, { onConflict: 'id' });

          return NextResponse.json({ success: true, message: `Staff profile created for ${email}. They can log in with their existing account.` });
        }

        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Upsert user_profiles row with the correct role
    if (data?.user?.id) {
      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email,
          full_name,
          role,
          is_active: true,
        }, { onConflict: 'id' });
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err: any) {
    console.error('Invite staff error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
