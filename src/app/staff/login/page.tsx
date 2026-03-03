'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Invalid email or password. Please try again.');
        return;
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
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AppLogo size={64} iconName="FireIcon" text="CateringHub" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1612] mt-4">Staff Portal</h1>
          <p className="text-[#8C8278] text-sm mt-1">Sign in to access the workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#DDD5C8] p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
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
                placeholder="staff@cateringhub.com"
                className="w-full px-4 py-3 rounded-xl border border-[#DDD5C8] bg-[#FAFAF8] text-[#1A1612] placeholder-[#B0A89E] focus:outline-none focus:ring-2 focus:ring-[#C4622D] focus:border-transparent transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#3D3530] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-[#DDD5C8] bg-[#FAFAF8] text-[#1A1612] placeholder-[#B0A89E] focus:outline-none focus:ring-2 focus:ring-[#C4622D] focus:border-transparent transition-all text-sm"
              />
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
