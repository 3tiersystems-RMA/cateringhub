'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface VoucherInfo {
  id: string;
  voucher_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_meals: number;
  meals_remaining: number;
  status: string;
  purchased_at: string;
  package_type: string;
  notes: string | null;
}

interface RedemptionRecord {
  id: string;
  voucher_code: string;
  meals_used: number;
  redeemed_at: string;
  notes: string | null;
  redeemed_by: string;
  meals_remaining_before: number;
  meals_remaining_after: number;
}

type ScanState = 'idle' | 'found' | 'success' | 'error';

const PACKAGE_LABELS: Record<string, string> = {
  'none': 'Single',
  'package-6': '6-Meal Package',
  'package-10': '10-Meal Package',
  'package-12': '12-Meal Package',
  'package-24': '24-Meal Package',
};

export default function VoucherScannerPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  const [voucherCode, setVoucherCode] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [voucher, setVoucher] = useState<VoucherInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [mealsToRedeem, setMealsToRedeem] = useState(1);
  const [redemptionNote, setRedemptionNote] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [lastRedemption, setLastRedemption] = useState<RedemptionRecord | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<RedemptionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/staff/login?redirect=/staff/scanner');
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email, role, is_active')
        .eq('id', session.user.id)
        .single();

      if (!profile || !profile.is_active) {
        router.push('/staff/login');
        return;
      }
      setStaffName(profile.full_name || session.user.email || 'Staff');
      setStaffEmail(session.user.email || '');
      setAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  // Load recent redemptions
  const loadRecentRedemptions = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('voucher_redemptions')
        .select('*')
        .order('redeemed_at', { ascending: false })
        .limit(10);
      if (data) setRecentRedemptions(data);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) {
      loadRecentRedemptions();
      inputRef.current?.focus();
    }
  }, [authChecked, loadRecentRedemptions]);

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;

    setScanState('idle');
    setVoucher(null);
    setErrorMsg('');
    setLastRedemption(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('voucher_code', code)
      .single();

    if (error || !data) {
      setScanState('error');
      setErrorMsg(`Voucher code "${code}" not found. Please check and try again.`);
      return;
    }

    setVoucher(data);
    setMealsToRedeem(1);
    setRedemptionNote('');

    if (data.status === 'redeemed' || data.meals_remaining <= 0) {
      setScanState('error');
      setErrorMsg('This voucher has been fully redeemed — no meals remaining.');
      return;
    }
    if (data.status === 'expired') {
      setScanState('error');
      setErrorMsg('This voucher has expired and cannot be redeemed.');
      return;
    }
    if (data.status === 'unpaid' || data.status === 'pending') {
      setScanState('error');
      setErrorMsg('This voucher has not been paid for yet and cannot be redeemed.');
      return;
    }

    setScanState('found');
  };

  const handleRedeem = async () => {
    if (!voucher || isRedeeming) return;
    if (mealsToRedeem < 1 || mealsToRedeem > voucher.meals_remaining) return;

    setIsRedeeming(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const mealsAfter = voucher.meals_remaining - mealsToRedeem;

    try {
      // Insert redemption record
      const { data: redemptionData, error: redemptionError } = await supabase
        .from('voucher_redemptions')
        .insert({
          voucher_code: voucher.voucher_code,
          meals_used: mealsToRedeem,
          redeemed_at: now,
          notes: redemptionNote || `Scanned by ${staffName}`,
          redeemed_by: staffEmail || staffName,
          customer_name: voucher.customer_name,
          customer_email: voucher.customer_email,
          meals_remaining_before: voucher.meals_remaining,
          meals_remaining_after: mealsAfter,
        })
        .select()
        .single();

      if (redemptionError) throw redemptionError;

      // Update voucher meals_remaining and status
      const newStatus = mealsAfter <= 0 ? 'redeemed' : 'active';
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({
          meals_remaining: mealsAfter,
          status: newStatus,
          updated_at: now,
        })
        .eq('voucher_code', voucher.voucher_code);

      if (updateError) throw updateError;

      setLastRedemption(redemptionData);
      setScanState('success');
      setVoucher({ ...voucher, meals_remaining: mealsAfter, status: newStatus });
      await loadRecentRedemptions();
    } catch (err: unknown) {
      setScanState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Redemption failed. Please try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleReset = () => {
    setVoucherCode('');
    setScanState('idle');
    setVoucher(null);
    setErrorMsg('');
    setLastRedemption(null);
    setMealsToRedeem(1);
    setRedemptionNote('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#A09890] text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="bg-[#111] border-b border-[#222] px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/staff/workspace" className="text-[#A09890] hover:text-white transition-colors">
            <Icon name="ArrowLeftIcon" size={20} />
          </Link>
          <AppLogo size={48} />
          <div>
            <h1 className="text-base font-semibold text-white">Voucher Scanner</h1>
            <p className="text-xs text-[#A09890]">Meal delivery verification</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#A09890]">
          <Icon name="UserCircleIcon" size={16} />
          <span className="hidden sm:inline">{staffName}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Scanner Panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Scan Input */}
          <div className="bg-[#141414] border border-[#222] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#C4622D]/15 flex items-center justify-center">
                <Icon name="QrCodeIcon" size={20} className="text-[#C4622D]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Scan or Enter Voucher Code</h2>
                <p className="text-xs text-[#A09890]">Use a barcode scanner or type the code manually</p>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VCHR-ABCD-1234"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3.5 text-white placeholder-[#555] text-base font-mono tracking-wider focus:outline-none focus:border-[#C4622D] transition-colors pr-12"
                  autoComplete="off"
                  spellCheck={false}
                />
                {voucherCode && (
                  <button
                    type="button"
                    onClick={() => setVoucherCode('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                  >
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!voucherCode.trim()}
                className="w-full bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Icon name="MagnifyingGlassIcon" size={18} />
                Look Up Voucher
              </button>
            </form>
          </div>

          {/* Error State */}
          {scanState === 'error' && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="ExclamationTriangleIcon" size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-300 mb-1">Voucher Invalid</p>
                  <p className="text-sm text-red-400/80">{errorMsg}</p>
                  {voucher && (
                    <div className="mt-3 pt-3 border-t border-red-800/30 text-xs text-red-400/60 space-y-1">
                      <p>Customer: {voucher.customer_name}</p>
                      <p>Status: <span className="capitalize">{voucher.status}</span></p>
                      <p>Meals remaining: {voucher.meals_remaining} / {voucher.total_meals}</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleReset}
                className="mt-4 w-full text-sm text-red-400 hover:text-white border border-red-800/40 hover:border-red-600 rounded-xl py-2.5 transition-colors"
              >
                Scan Another Voucher
              </button>
            </div>
          )}

          {/* Found State — Voucher Details + Redeem */}
          {scanState === 'found' && voucher && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
              {/* Voucher Header */}
              <div className="bg-gradient-to-r from-[#C4622D]/20 to-transparent border-b border-[#222] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-900/40 flex items-center justify-center">
                    <Icon name="CheckCircleIcon" size={18} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-[#A09890]">Voucher Found</p>
                    <p className="text-sm font-mono font-semibold text-white">{voucher.voucher_code}</p>
                  </div>
                </div>
                <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/40 px-3 py-1 rounded-full font-medium capitalize">
                  {voucher.status}
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#666] mb-1">Customer</p>
                    <p className="text-sm font-medium text-white">{voucher.customer_name}</p>
                    <p className="text-xs text-[#A09890]">{voucher.customer_email}</p>
                    {voucher.customer_phone && (
                      <p className="text-xs text-[#A09890]">{voucher.customer_phone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-[#666] mb-1">Package</p>
                    <p className="text-sm font-medium text-white">
                      {PACKAGE_LABELS[voucher.package_type] || voucher.package_type}
                    </p>
                    <p className="text-xs text-[#A09890]">Purchased {formatDateTime(voucher.purchased_at)}</p>
                  </div>
                </div>

                {/* Meal Progress */}
                <div className="bg-[#1A1A1A] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-[#666] font-medium uppercase tracking-wide">Meal Balance</p>
                    <p className="text-sm font-semibold text-white">
                      <span className="text-[#C4622D] text-lg">{voucher.meals_remaining}</span>
                      <span className="text-[#555]"> / {voucher.total_meals}</span>
                    </p>
                  </div>
                  <div className="w-full bg-[#2A2A2A] rounded-full h-2.5">
                    <div
                      className="bg-[#C4622D] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${(voucher.meals_remaining / voucher.total_meals) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-[#555]">
                    <span>{voucher.total_meals - voucher.meals_remaining} used</span>
                    <span>{voucher.meals_remaining} left</span>
                  </div>
                </div>

                {/* Redemption Form */}
                <div className="space-y-4 pt-2 border-t border-[#222]">
                  <p className="text-xs font-semibold text-[#A09890] uppercase tracking-wide">Redeem Meals</p>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-[#666] mb-1.5 block">Meals to deliver now</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMealsToRedeem(Math.max(1, mealsToRedeem - 1))}
                          className="w-9 h-9 rounded-lg bg-[#222] hover:bg-[#2A2A2A] text-white flex items-center justify-center transition-colors"
                        >
                          <Icon name="MinusIcon" size={16} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={voucher.meals_remaining}
                          value={mealsToRedeem}
                          onChange={(e) => {
                            const v = parseInt(e.target.value) || 1;
                            setMealsToRedeem(Math.min(Math.max(1, v), voucher.meals_remaining));
                          }}
                          className="w-16 text-center bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg py-2 text-white text-sm font-semibold focus:outline-none focus:border-[#C4622D]"
                        />
                        <button
                          type="button"
                          onClick={() => setMealsToRedeem(Math.min(voucher.meals_remaining, mealsToRedeem + 1))}
                          className="w-9 h-9 rounded-lg bg-[#222] hover:bg-[#2A2A2A] text-white flex items-center justify-center transition-colors"
                        >
                          <Icon name="PlusIcon" size={16} />
                        </button>
                        <span className="text-xs text-[#555]">of {voucher.meals_remaining} available</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#666] mb-1.5 block">Note (optional)</label>
                    <input
                      type="text"
                      value={redemptionNote}
                      onChange={(e) => setRedemptionNote(e.target.value)}
                      placeholder="e.g. Delivered at gate 3"
                      className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#C4622D] transition-colors"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleRedeem}
                      disabled={isRedeeming}
                      className="flex-1 bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      {isRedeeming ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <Icon name="CheckIcon" size={18} />
                          Confirm Delivery ({mealsToRedeem} meal{mealsToRedeem > 1 ? 's' : ''})
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-4 py-3 rounded-xl border border-[#2A2A2A] text-[#A09890] hover:text-white hover:border-[#444] transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {scanState === 'success' && lastRedemption && voucher && (
            <div className="bg-[#141414] border border-green-800/40 rounded-2xl overflow-hidden">
              <div className="bg-green-900/20 border-b border-green-800/30 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-900/40 flex items-center justify-center">
                  <Icon name="CheckCircleIcon" size={22} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-300">Delivery Confirmed!</p>
                  <p className="text-xs text-green-500/70">{formatDateTime(lastRedemption.redeemed_at)}</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[#666] mb-1">Voucher</p>
                    <p className="font-mono font-semibold text-white">{lastRedemption.voucher_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#666] mb-1">Customer</p>
                    <p className="font-medium text-white">{voucher.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#666] mb-1">Meals Delivered</p>
                    <p className="text-[#C4622D] font-bold text-lg">{lastRedemption.meals_used}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#666] mb-1">Remaining Balance</p>
                    <p className="font-semibold text-white">
                      {lastRedemption.meals_remaining_after}
                      <span className="text-xs text-[#555] ml-1">/ {voucher.total_meals}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#666] mb-1">Scanned By</p>
                    <p className="text-sm text-[#A09890]">{lastRedemption.redeemed_by || staffName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#666] mb-1">Voucher Status</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      voucher.status === 'redeemed' ?'bg-gray-800 text-gray-400' :'bg-green-900/40 text-green-400'
                    }`}>
                      {voucher.status}
                    </span>
                  </div>
                </div>

                {lastRedemption.notes && (
                  <div className="bg-[#1A1A1A] rounded-xl px-4 py-3">
                    <p className="text-xs text-[#666] mb-1">Note</p>
                    <p className="text-sm text-[#A09890]">{lastRedemption.notes}</p>
                  </div>
                )}

                <button
                  onClick={handleReset}
                  className="w-full bg-[#C4622D] hover:bg-[#A04E22] text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Icon name="QrCodeIcon" size={18} />
                  Scan Next Voucher
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent Redemptions */}
        <div className="lg:col-span-2">
          <div className="bg-[#141414] border border-[#222] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="ClockIcon" size={16} className="text-[#A09890]" />
                <h3 className="text-sm font-semibold text-white">Recent Redemptions</h3>
              </div>
              <button
                onClick={loadRecentRedemptions}
                disabled={loadingHistory}
                className="text-xs text-[#A09890] hover:text-white transition-colors flex items-center gap-1"
              >
                <Icon name="ArrowPathIcon" size={13} className={loadingHistory ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <div className="divide-y divide-[#1E1E1E] max-h-[600px] overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentRedemptions.length === 0 ? (
                <div className="py-10 text-center">
                  <Icon name="InboxIcon" size={28} className="text-[#333] mx-auto mb-2" />
                  <p className="text-xs text-[#555]">No redemptions yet</p>
                </div>
              ) : (
                recentRedemptions.map((r) => (
                  <div key={r.id} className="px-5 py-3.5 hover:bg-[#1A1A1A] transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-mono font-semibold text-[#C4622D]">{r.voucher_code}</p>
                      <span className="text-xs text-[#555] whitespace-nowrap flex-shrink-0">
                        {formatDateTime(r.redeemed_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#A09890]">{r.customer_name || '—'}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-[#C4622D]/15 text-[#C4622D] px-2 py-0.5 rounded-full font-medium">
                          -{r.meals_used} meal{r.meals_used > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-[#555]">
                          {r.meals_remaining_after} left
                        </span>
                      </div>
                    </div>
                    {r.redeemed_by && (
                      <p className="text-xs text-[#444] mt-0.5">by {r.redeemed_by}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
