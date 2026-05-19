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

    // Invite user via Supabase Auth (sends magic link email)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name,
        role,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://cardamomkitchen.co.za'}/auth/callback`,
    });

    if (error) {
      // If user already exists, still create/update their profile
      if (error.message?.includes('already been registered')) {
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
