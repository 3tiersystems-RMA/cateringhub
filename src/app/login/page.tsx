"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppIcon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";

function CustomerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/customer-profile";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      // Small delay to ensure the Supabase session is fully committed to
      // storage (cookie / localStorage) before the next page mounts and
      // AuthContext reads it. Without this, getSession() on the destination
      // page can race against the setAll() write and return null.
      await new Promise((resolve) => setTimeout(resolve, 150));
      router.push(redirectTo);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-[#C4622D]/15 border border-[#C4622D]/25 flex items-center justify-center mx-auto mb-5">
        <AppIcon name="UserIcon" size={24} className="text-[#C4622D]" />
      </div>

      <h1 className="text-2xl font-bold text-white text-center mb-1">
        Customer Sign In
      </h1>
      <p className="text-[#A09890] text-sm text-center mb-6">
        Sign in to view your orders and profile
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[#A09890] mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#C4622D]/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-[#A09890] mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#C4622D]/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#A09890] transition-colors"
            >
              <AppIcon name={showPassword ? "EyeSlashIcon" : "EyeIcon"} size={18} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-semibold transition-colors mt-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <AppIcon name="ArrowRightOnRectangleIcon" size={16} />
              Sign In
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-[#555] text-center mt-5">
        Your data is protected under the Protection of Personal Information Act (POPIA).
      </p>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />
      <main className="pt-24 pb-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Back link */}
          <div className="mb-6">
            <Link
              href="/homepage"
              className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <AppIcon name="ArrowLeftIcon" size={14} />
              Back to Home
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <CustomerLoginForm />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
