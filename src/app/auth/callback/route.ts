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
  const flowType = type || 'email';

  const supabase = await createClient();

  // Handle email-based flows (password recovery, magic link, email confirmation, invite)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink' | 'email_change',
    });

    if (!error) {
      if (type === 'invite') {
        return NextResponse.redirect(`${SITE_URL}/staff/reset-password?type=invite`);
      }
      if (type === 'recovery') {
        return NextResponse.redirect(`${SITE_URL}/staff/reset-password?type=recovery`);
      }
      return NextResponse.redirect(`${SITE_URL}${next}`);
    }
  }

  // Handle OAuth / PKCE code exchange flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (flowType === 'invite') {
        return NextResponse.redirect(`${SITE_URL}/staff/reset-password?type=invite`);
      }
      if (flowType === 'recovery') {
        return NextResponse.redirect(`${SITE_URL}/staff/reset-password?type=recovery`);
      }
      return NextResponse.redirect(`${SITE_URL}${next}`);
    }
  }

  // Forward to client confirm page (handles hash tokens and retries query params)
  const confirmUrl = new URL(`${SITE_URL}/auth/confirm`);
  searchParams.forEach((value, key) => confirmUrl.searchParams.set(key, value));
  return NextResponse.redirect(confirmUrl.toString());
}
