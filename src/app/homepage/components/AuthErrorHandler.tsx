'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthErrorHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location?.hash;
    if (!hash) return;

    // Parse hash fragment params (e.g. #error=access_denied&error_code=otp_expired)
    const hashParams = new URLSearchParams(hash.substring(1));
    const error = hashParams?.get('error');
    const errorCode = hashParams?.get('error_code');

    if (error) {
      // Determine the most user-friendly error message
      let errorType = 'auth_error';
      if (errorCode === 'otp_expired' || error === 'access_denied') {
        errorType = 'link_expired';
      }

      // Clear the hash and redirect to login with error param
      router?.replace(`/staff/login?error=${errorType}`);
    }
  }, [router]);

  return null;
}
