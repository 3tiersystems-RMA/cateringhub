import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api/staff-auth';
import {
  findAuthUserByEmail,
  findProfileByEmail,
  getSupabaseAdmin,
} from '@/lib/api/supabase-admin';
import { loadStaffEmailBranding, sendViaEdgeOrResend } from '@/lib/email/staff-email-delivery';
import { sendStaffPromotedViaResend } from '@/lib/email/staff-promoted';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const phone_number = String(body.phone_number || '').trim();
    const role = body.role;

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required.' }, { status: 400 });
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

    const existingProfile = await findProfileByEmail(supabaseAdmin, email);
    const authUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (!authUser) {
      if (existingProfile) {
        return NextResponse.json(
          {
            error:
              'A staff profile exists for this email but the login account is missing. Use "+ Invite Staff" to send a new invitation link.',
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error:
            'No account found for this email. Use "+ Invite Staff" to create a new staff account instead.',
        },
        { status: 404 }
      );
    }

    const profileForAuth =
      existingProfile?.id === authUser.id
        ? existingProfile
        : await findProfileByEmail(supabaseAdmin, authUser.email || email);

    if (profileForAuth?.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot change the role of a super admin account.' },
        { status: 403 }
      );
    }

    if (
      profileForAuth &&
      profileForAuth.role === role &&
      profileForAuth.is_active === true
    ) {
      return NextResponse.json(
        {
          error: `This user is already an active ${role}. Use Edit Details to change their information.`,
        },
        { status: 409 }
      );
    }

    const resolvedName =
      full_name ||
      profileForAuth?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.email?.split('@')[0] ||
      '';

    const profilePayload = {
      id: authUser.id,
      email: (authUser.email || profileForAuth?.email || email).toLowerCase(),
      full_name: resolvedName,
      phone: phone_number || profileForAuth?.phone || authUser.phone || null,
      role,
      is_active: true,
    };

    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        ...authUser.user_metadata,
        full_name: resolvedName,
        role,
      },
    });

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://cardamomkitchen.co.za'
    ).replace(/\/$/, '');

    const branding = await loadStaffEmailBranding(supabaseAdmin);
    const emailPayload = {
      recipientEmail: email,
      recipientName: resolvedName,
      role,
      loginUrl: `${siteUrl}/staff/login`,
      ...branding,
    };

    try {
      await sendViaEdgeOrResend('send-staff-promoted', emailPayload, () =>
        sendStaffPromotedViaResend(emailPayload)
      );
    } catch (emailErr) {
      console.warn('[promote] Notification email failed (promotion still saved):', emailErr);
    }

    const wasReactivated =
      profileForAuth?.is_active === false && profileForAuth.role === role;
    const wasRoleChange =
      profileForAuth && profileForAuth.role !== role;

    let message = `${email} has been promoted to ${role}. They can log in with their existing password.`;
    if (wasReactivated) {
      message = `${resolvedName} has been reactivated as ${role}. A notification email was sent.`;
    } else if (wasRoleChange) {
      message = `${resolvedName}'s role has been updated to ${role}. A notification email was sent.`;
    } else {
      message = `${resolvedName} has been promoted to ${role}. A notification email was sent with login instructions.`;
    }

    return NextResponse.json({ success: true, message });
  } catch (err: unknown) {
    console.error('Promote staff error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
