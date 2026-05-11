'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { APP_NAME } from '@/lib/constants';

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const reasonParam = searchParams.get('reason');
    if (errorParam === 'link_expired') {
      setError('Your password reset link has expired or is invalid. Please request a new one from the Staff Management page.');
    } else if (errorParam === 'auth_error') {
      setError('Authentication failed. Please try again or request a new password reset link.');
    }
    if (reasonParam === 'timeout') {
      setInfoMessage('You were logged out due to inactivity.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Invalid email or password. Please try again.');
        return;
      }

      // Check if account is active (suspended check)
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_active')
          .eq('id', authData.user.id)
          .single();

        if (profile && profile.is_active === false) {
          // Sign out immediately — suspended user should not have a session
          await supabase.auth.signOut();
          setError('Account suspended — Contact your Admin');
          return;
        }
      }

      router.push('/staff/workspace');
      router.refresh();
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AppLogo size={64} iconName="FireIcon" text={APP_NAME} />
          </div>
          <h1 className="text-2xl font-bold text-[#8C8278] mt-4">Staff Portal</h1>
          <p className="text-[#8C8278] text-sm mt-1">Sign in to access the workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#DDD5C8] p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Inactivity info message */}
            {infoMessage && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg px-4 py-3">
                <span className="font-semibold block mb-0.5">⏱ Session Expired</span>
                {infoMessage}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className={`border text-sm rounded-lg px-4 py-3 ${
                error.includes('suspended')
                  ? 'bg-amber-50 border-amber-300 text-amber-800' : error.includes('expired') || error.includes('invalid')
                  ? 'bg-orange-50 border-orange-300 text-orange-800' :'bg-red-50 border-red-200 text-red-700'
              }`}>
                {error.includes('suspended') && (
                  <span className="font-semibold block mb-0.5">⚠️ Access Denied</span>
                )}
                {(error.includes('expired') || error.includes('invalid')) && (
                  <span className="font-semibold block mb-0.5">🔗 Link Expired</span>
                )}
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#3D3530] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="staff@cardamomkitchen.co.za"
                className="w-full px-4 py-3 rounded-xl border border-[#DDD5C8] bg-[#FAFAF8] text-[#1A1612] placeholder-[#B0A89E] focus:outline-none focus:ring-2 focus:ring-[#C4622D] focus:border-transparent transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#3D3530] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#DDD5C8] bg-[#FAFAF8] text-[#1A1612] placeholder-[#B0A89E] focus:outline-none focus:ring-2 focus:ring-[#C4622D] focus:border-transparent transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8278] hover:text-[#C4622D] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In to Staff Portal'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#B0A89E] mt-6">
          This portal is for authorized staff only.
        </p>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#C4622D] border-t-transparent rounded-full" />
      </div>
    }>
      <StaffLoginForm />
    </Suspense>
  );
}
