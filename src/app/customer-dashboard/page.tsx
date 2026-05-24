"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppIcon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";

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
  customer_name: string;
  customer_email: string;
}

type ViewState = "lookup" | "dashboard";

const PACKAGE_LABELS: Record<string, string> = {
  none: "Single",
  "package-6": "6-Meal Package",
  "package-10": "10-Meal Package",
  "package-12": "12-Meal Package",
  "package-24": "24-Meal Package",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border border-green-500/30",
  redeemed: "bg-[#A09890]/15 text-[#A09890] border border-[#A09890]/30",
  expired: "bg-red-500/15 text-red-400 border border-red-500/30",
  unpaid: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  pending: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CustomerDashboardPage() {
  const [viewState, setViewState] = useState<ViewState>("lookup");
  const [voucherCode, setVoucherCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voucher, setVoucher] = useState<VoucherInfo | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch voucher
      const { data: voucherData, error: voucherError } = await supabase
        .from("vouchers")
        .select("*")
        .eq("voucher_code", code)
        .single();

      if (voucherError || !voucherData) {
        setError(`Voucher code "${code}" not found. Please check and try again.`);
        return;
      }

      // Fetch redemptions for this voucher
      const { data: redemptionData } = await supabase
        .from("voucher_redemptions")
        .select("*")
        .eq("voucher_code", code)
        .order("redeemed_at", { ascending: false });

      setVoucher(voucherData);
      setRedemptions(redemptionData || []);
      setViewState("dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setViewState("lookup");
    setVoucher(null);
    setRedemptions([]);
    setVoucherCode("");
    setError(null);
  };

  const mealsUsed = voucher ? voucher.total_meals - voucher.meals_remaining : 0;
  const progressPct = voucher ? Math.round((mealsUsed / voucher.total_meals) * 100) : 0;

  // ── LOOKUP SCREEN ──────────────────────────────────────────────────────────
  if (viewState === "lookup") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <Header />
        <main className="pt-24 pb-20 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <Link
                href="/homepage"
                className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
              >
                <AppIcon name="ArrowLeftIcon" size={14} />
                Back to Home
              </Link>
            </div>

            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#C4622D]/15 border border-[#C4622D]/25 flex items-center justify-center mx-auto mb-5">
                <AppIcon name="TicketIcon" size={26} className="text-[#C4622D]" />
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-1">
                Voucher Dashboard
              </h1>
              <p className="text-[#A09890] text-sm text-center mb-7 leading-relaxed">
                Enter your voucher code to view your redemption history, remaining balance, and visit details.
              </p>

              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
                    Voucher Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                      <AppIcon name="QrCodeIcon" size={16} className="text-[#555]" />
                    </div>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => {
                        setVoucherCode(e.target.value.toUpperCase());
                        setError(null);
                      }}
                      placeholder="e.g. VCH-XXXX-XXXX"
                      className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#C4622D] transition-colors font-mono tracking-wider"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 text-red-400 text-sm px-4 py-3 rounded-xl">
                    <AppIcon name="ExclamationCircleIcon" size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !voucherCode.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Looking up…
                    </>
                  ) : (
                    <>
                      <AppIcon name="MagnifyingGlassIcon" size={16} />
                      View My Voucher
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-[#555] text-center mt-5 leading-relaxed">
                Your voucher code was included in your purchase confirmation email.
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── DASHBOARD SCREEN ───────────────────────────────────────────────────────
  if (!voucher) return null;

  const packageLabel =
    PACKAGE_LABELS[voucher.package_type] ||
    (voucher.total_meals > 0 ? `${voucher.total_meals}-Meal Package` : "Meal Voucher");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />

      <main className="pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          {/* Back */}
          <div className="mb-6">
            <button
              onClick={handleReset}
              className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <AppIcon name="ArrowLeftIcon" size={14} />
              Look up a different voucher
            </button>
          </div>

          {/* Voucher Hero Card */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-[#C4622D]/15 border border-[#C4622D]/25 flex items-center justify-center shrink-0">
                <AppIcon name="TicketIcon" size={26} className="text-[#C4622D]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                    {packageLabel}
                  </h1>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                      STATUS_STYLES[voucher.status] || STATUS_STYLES.active
                    }`}
                  >
                    {voucher.status}
                  </span>
                </div>
                <p className="text-[#A09890] text-sm font-mono tracking-wider mb-1">
                  {voucher.voucher_code}
                </p>
                <p className="text-[#666] text-xs">
                  Purchased {formatDate(voucher.purchased_at)} · {voucher.customer_name}
                </p>
              </div>

              {/* Stats */}
              <div className="flex gap-3 shrink-0">
                <div className="text-center px-4 py-3 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] min-w-[72px]">
                  <p className="text-2xl font-bold text-white">{voucher.meals_remaining}</p>
                  <p className="text-xs text-[#666] mt-0.5">Remaining</p>
                </div>
                <div className="text-center px-4 py-3 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] min-w-[72px]">
                  <p className="text-2xl font-bold text-[#C4622D]">{mealsUsed}</p>
                  <p className="text-xs text-[#666] mt-0.5">Used</p>
                </div>
                <div className="text-center px-4 py-3 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] min-w-[72px]">
                  <p className="text-2xl font-bold text-white">{voucher.total_meals}</p>
                  <p className="text-xs text-[#666] mt-0.5">Total</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#666] uppercase tracking-wider">
                  Meal Balance
                </span>
                <span className="text-xs text-[#A09890]">
                  {mealsUsed} of {voucher.total_meals} meals used ({progressPct}%)
                </span>
              </div>
              <div className="h-2.5 bg-[#1E1E1E] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C4622D] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-[#555]">0</span>
                <span className="text-xs text-[#555]">{voucher.total_meals} meals</span>
              </div>
            </div>
          </div>

          {/* Redemption History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Redemption History</h2>
                <p className="text-xs text-[#666] mt-0.5">
                  {redemptions.length} visit{redemptions.length !== 1 ? "s" : ""} recorded
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#666] bg-[#141414] border border-[#2A2A2A] px-3 py-1.5 rounded-lg">
                <AppIcon name="ClockIcon" size={13} />
                Most recent first
              </div>
            </div>

            {redemptions.length === 0 ? (
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] flex items-center justify-center mx-auto mb-4">
                  <AppIcon name="ClipboardDocumentListIcon" size={28} className="text-[#555]" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">No redemptions yet</h3>
                <p className="text-[#A09890] text-sm">
                  Your meal redemption history will appear here after your first visit.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {redemptions.map((r, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div
                      key={r.id}
                      className={`bg-[#141414] border rounded-2xl overflow-hidden transition-colors ${
                        isLatest ? "border-[#C4622D]/30" : "border-[#2A2A2A]"
                      }`}
                    >
                      {isLatest && (
                        <div className="bg-[#C4622D]/10 border-b border-[#C4622D]/20 px-5 py-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C4622D] inline-block" />
                          <span className="text-xs font-semibold text-[#C4622D] uppercase tracking-wider">
                            Most Recent Visit
                          </span>
                        </div>
                      )}

                      <div className="p-5 md:p-6">
                        {/* Top row: date + visit number */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#C4622D]/15 border border-[#C4622D]/25 flex items-center justify-center shrink-0">
                              <AppIcon name="CalendarDaysIcon" size={16} className="text-[#C4622D]" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {formatDateTime(r.redeemed_at)}
                              </p>
                              <p className="text-xs text-[#666] mt-0.5">
                                Visit #{redemptions.length - idx}
                              </p>
                            </div>
                          </div>

                          {/* Meals redeemed badge */}
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 bg-[#C4622D]/10 border border-[#C4622D]/25 text-[#C4622D] text-sm font-bold px-3 py-1.5 rounded-xl">
                              <AppIcon name="FireIcon" size={14} />
                              {r.meals_used} meal{r.meals_used !== 1 ? "s" : ""} redeemed
                            </span>
                          </div>
                        </div>

                        {/* Detail grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Staff member */}
                          <div className="bg-[#0F0F0F] rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-1">
                              Served By
                            </p>
                            <div className="flex items-center gap-2">
                              <AppIcon name="UserCircleIcon" size={14} className="text-[#A09890] shrink-0" />
                              <p className="text-sm text-white truncate">
                                {r.redeemed_by || "—"}
                              </p>
                            </div>
                          </div>

                          {/* Balance before */}
                          <div className="bg-[#0F0F0F] rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-1">
                              Balance Before
                            </p>
                            <div className="flex items-center gap-2">
                              <AppIcon name="ChartBarIcon" size={14} className="text-[#A09890] shrink-0" />
                              <p className="text-sm text-white">
                                {r.meals_remaining_before ?? "—"} meal{r.meals_remaining_before !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>

                          {/* Balance after */}
                          <div className="bg-[#0F0F0F] rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-1">
                              Balance After
                            </p>
                            <div className="flex items-center gap-2">
                              <AppIcon
                                name="CheckCircleIcon"
                                size={14}
                                className={`shrink-0 ${
                                  (r.meals_remaining_after ?? 0) === 0
                                    ? "text-[#A09890]"
                                    : "text-green-400"
                                }`}
                              />
                              <p
                                className={`text-sm font-semibold ${
                                  (r.meals_remaining_after ?? 0) === 0
                                    ? "text-[#A09890]"
                                    : "text-green-400"
                                }`}
                              >
                                {r.meals_remaining_after ?? "—"} meal{r.meals_remaining_after !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {r.notes && (
                          <div className="mt-3 flex items-start gap-2 bg-[#0F0F0F] rounded-xl px-4 py-3">
                            <AppIcon name="ChatBubbleLeftIcon" size={14} className="text-[#555] shrink-0 mt-0.5" />
                            <p className="text-xs text-[#A09890] leading-relaxed">{r.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary footer */}
            {redemptions.length > 0 && (
              <div className="mt-6 bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {voucher.meals_remaining > 0
                      ? `${voucher.meals_remaining} meal${voucher.meals_remaining !== 1 ? "s" : ""} remaining`
                      : "All meals have been redeemed"}
                  </p>
                  <p className="text-xs text-[#666] mt-0.5">
                    {voucher.meals_remaining > 0
                      ? "Your voucher is still active — enjoy your next meal!" :"Thank you for dining with us. Purchase a new voucher to continue."}
                  </p>
                </div>
                {voucher.meals_remaining === 0 && (
                  <Link
                    href="/vouchers"
                    className="flex items-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
                  >
                    <AppIcon name="TicketIcon" size={15} />
                    Buy New Voucher
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
