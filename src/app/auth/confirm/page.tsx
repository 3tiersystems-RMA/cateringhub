'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Client-side entry for staff invite & password-reset email links.
 * Handles PKCE (?code=), OTP (?token_hash=&type=), and hash (#access_token=) flows.
 */
function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Verifying your link…');

  useEffect(() => {
    let cancelled = false;

    const goNext = (type: string | null) => {
      if (type === 'invite') {
        router.replace('/staff/reset-password?type=invite');
      } else if (type === 'recovery') {
        router.replace('/staff/reset-password?type=recovery');
      } else {
        router.replace('/staff/workspace');
      }
    };

    const fail = () => {
      router.replace('/staff/login?error=link_expired');
    };

    const run = async () => {
      const supabase = createClient();
      const queryType = searchParams.get('type');
      const code = searchParams.get('code');
      const token_hash = searchParams.get('token_hash');
      const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
      const hashParams = new URLSearchParams(hash);
      const hashType = hashParams.get('type');
      const type = queryType || hashType;

      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');

      if (access_token && refresh_token) {
        setStatus('Signing you in…');
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (cancelled) return;
        if (error) {
          fail();
          return;
        }
        goNext(type);
        return;
      }

      if (token_hash && type) {
        setStatus('Verifying invitation…');
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'invite' | 'recovery' | 'email' | 'signup' | 'magiclink' | 'email_change',
        });
        if (cancelled) return;
        if (error) {
          fail();
          return;
        }
        goNext(type);
        return;
      }

      if (code) {
        setStatus('Completing sign-in…');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          fail();
          return;
        }
        goNext(type);
        return;
      }

      fail();
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF5EE]">
      <p className="text-sm text-[#5C5347]">{status}</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF5EE]">
          <p className="text-sm text-[#5C5347]">Verifying your link…</p>
        </div>
      }
    >
      <AuthConfirmContent />
    </Suspense>
  );
}
