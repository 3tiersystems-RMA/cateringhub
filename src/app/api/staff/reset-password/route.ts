import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api/staff-auth';
import { findAuthUserByEmail, getSupabaseAdmin } from '@/lib/api/supabase-admin';
import { loadStaffEmailBranding, sendViaEdgeOrResend } from '@/lib/email/staff-email-delivery';
import { sendStaffPasswordResetViaResend } from '@/lib/email/staff-password-reset';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
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

    const authUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!authUser) {
      return NextResponse.json(
        { error: 'No account found for this email. Use "Send Invite" for new staff.' },
        { status: 404 }
      );
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://cardamomkitchen.co.za'
    ).replace(/\/$/, '');
    const recoveryRedirectTo = `${siteUrl}/auth/confirm?type=recovery`;

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: recoveryRedirectTo,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json(
        { error: linkError?.message || 'Failed to generate password reset link.' },
        { status: 400 }
      );
    }

    const branding = await loadStaffEmailBranding(supabaseAdmin);
    const emailPayload = {
      recipientEmail: email,
      recipientName:
        full_name ||
        authUser.user_metadata?.full_name ||
        email.split('@')[0],
      resetLink: linkData.properties.action_link,
      ...branding,
    };

    const emailId = await sendViaEdgeOrResend(
      'send-staff-password-reset',
      emailPayload,
      () => sendStaffPasswordResetViaResend(emailPayload)
    );

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${email}`,
      emailId,
    });
  } catch (err: unknown) {
    console.error('Reset password route error:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
