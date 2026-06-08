import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api/staff-auth';
import { findAuthUserByEmail, getSupabaseAdmin } from '@/lib/api/supabase-admin';
import { loadStaffEmailBranding, sendViaEdgeOrResend } from '@/lib/email/staff-email-delivery';
import { sendStaffInviteViaResend } from '@/lib/email/staff-invite';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const phone_number = String(body.phone_number || '').trim();
    const role = body.role;

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required.' }, { status: 400 });
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

    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, role')
      .ilike('email', email)
      .in('role', ['staff', 'admin', 'super_admin'])
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            'A staff member with this email already exists. Use "Promote Existing User" if they need a different role.',
        },
        { status: 409 }
      );
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://cardamomkitchen.co.za'
    ).replace(/\/$/, '');
    const inviteRedirectTo = `${siteUrl}/auth/confirm?type=invite`;
    const profilePayload = {
      email,
      full_name,
      phone: phone_number || null,
      role,
      is_active: true,
    };

    const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (existingAuthUser) {
      const { error: upsertError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({ id: existingAuthUser.id, ...profilePayload }, { onConflict: 'id' });

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Staff profile created for ${email}. They can log in with their existing account.`,
      });
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { full_name, role },
        redirectTo: inviteRedirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link || !linkData?.user?.id) {
      return NextResponse.json(
        { error: linkError?.message || 'Failed to generate staff invitation link.' },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({ id: linkData.user.id, ...profilePayload }, { onConflict: 'id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const branding = await loadStaffEmailBranding(supabaseAdmin);
    const emailPayload = {
      recipientEmail: email,
      recipientName: full_name,
      inviteLink: linkData.properties.action_link,
      role,
      ...branding,
    };

    await sendViaEdgeOrResend('send-staff-invite', emailPayload, () =>
      sendStaffInviteViaResend(emailPayload)
    );

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}. They will receive an email to set their password.`,
    });
  } catch (err: unknown) {
    console.error('Invite staff error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
