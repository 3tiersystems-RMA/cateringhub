import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://cardamomkitchen.co.za';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/staff/workspace';

  const supabase = await createClient();

  // Handle email-based flows (password recovery, magic link, email confirmation, invite)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink' | 'email_change',
    });

    if (!error) {
      // Invite and recovery both go to set-password page
      if (type === 'recovery' || type === 'invite') {
        return NextResponse.redirect(`${SITE_URL}/staff/reset-password`);
      }
      return NextResponse.redirect(`${SITE_URL}${next}`);
    }
  }

  // Handle OAuth / PKCE code exchange flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery' || type === 'invite') {
        return NextResponse.redirect(`${SITE_URL}/staff/reset-password`);
      }
      return NextResponse.redirect(`${SITE_URL}${next}`);
    }
  }

  // Both flows failed — redirect to login with error indicator
  return NextResponse.redirect(`${SITE_URL}/staff/login?error=link_expired`);
}
