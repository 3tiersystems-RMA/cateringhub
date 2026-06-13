"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppIcon from "@/components/ui/AppIcon";

type SearchType = "reference" | "email" | "cellphone";

type PaymentStatus =
  | "pending" |"paid" |"failed" |"awaiting_payment" |"awaiting_confirmation" |"refunded" |"discounted" | "no-show";

interface SessionDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  fee: number | null;
}

interface BookingResult {
  id: string;
  type: "event" | "cooking_class";
  registration_code: string | null;
  title: string;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string;
  payment_status: PaymentStatus;
  payment_method: string;
  amount: number | null;
  created_at: string;
  selected_events: string[];
  session_dates: SessionDate[];
  notes: string | null;
  children: ParticipantRow[] | null;
}

interface ParticipantRow {
  fullName?: string;
  full_name?: string;
  name?: string;
  ticket_number?: string;
  [key: string]: unknown;
}

interface CreditTransaction {
  id: string;
  booking_ref: string;
  booking_type: string;
  amount_applied: number;
  balance_before: number;
  balance_after: number;
  applied_at: string;
  notes: string | null;
}

interface CustomerCredit {
  id: string;
  customer_email: string;
  customer_name: string;
  original_booking_ref: string;
  booking_type: string;
  total_issued: number;
  total_used: number;
  remaining_balance: number;
  credit_status: "active" | "used";
  issued_at: string;
  notes: string | null;
  transactions: CreditTransaction[];
}

function getParticipantName(p: ParticipantRow): string {
  return String(p.fullName || p.full_name || p.name || "").trim();
}

function filterFilledParticipants(children: ParticipantRow[] | null | undefined): ParticipantRow[] {
  if (!Array.isArray(children)) return [];
  return children.filter((p) => getParticipantName(p).length > 0);
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  awaiting_payment: "Awaiting Payment",
  awaiting_confirmation: "Awaiting Confirmation",
  refunded: "Refunded",
  discounted: "Discounted",
  "no-show": "No-Show",
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  paid: "bg-green-500/15 text-green-300 border border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border border-red-500/30",
  awaiting_payment: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  awaiting_confirmation: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  refunded: "bg-gray-500/15 text-gray-400 border border-gray-500/30",
  discounted: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
  "no-show": "bg-orange-500/15 text-orange-300 border border-orange-500/30",
};

const TYPE_LABELS: Record<"event" | "cooking_class", string> = {
  event: "Event Booking",
  cooking_class: "Cooking Class",
};

const TYPE_COLORS: Record<"event" | "cooking_class", string> = {
  event: "bg-[#C4622D]/15 text-[#C4622D] border border-[#C4622D]/30",
  cooking_class: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function formatCurrency(amount: number) {
  return `R ${amount.toFixed(2)}`;
}

const SEARCH_TABS: { id: SearchType; label: string; icon: string; placeholder: string }[] = [
  { id: "reference", label: "Reference No.", icon: "HashtagIcon", placeholder: "e.g. CC-AB12CD34 or EB-XY56ZW78" },
  { id: "email", label: "Email Address", icon: "EnvelopeIcon", placeholder: "your@email.com" },
  { id: "cellphone", label: "Cellphone", icon: "PhoneIcon", placeholder: "e.g. 0821234567" },
];

export default function BookingQueryPage() {
  const [searchType, setSearchType] = useState<SearchType>("reference");
  const [inputValue, setInputValue] = useState("");
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    setError(null);
    setBookings([]);
    setCredits([]);
    setSearched(false);
    setExpandedId(null);
    setExpandedCreditId(null);

    try {
      const params = new URLSearchParams({ type: searchType, value: inputValue.trim() });
      const res = await fetch(`/api/booking-query?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Unable to find bookings. Please check your details and try again.");
      } else {
        const results: BookingResult[] = json.bookings || [];
        const creditResults: CustomerCredit[] = json.credits || [];
        setBookings(results);
        setCredits(creditResults);
        setSearched(true);
        if (results.length > 0) {
          setExpandedId(results[0].id);
        }
        // Auto-expand first active credit
        const firstActive = creditResults.find((c) => c.credit_status === "active");
        if (firstActive) setExpandedCreditId(firstActive.id);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearched(false);
    setBookings([]);
    setCredits([]);
    setInputValue("");
    setError(null);
    setExpandedId(null);
    setExpandedCreditId(null);
  };

  const currentTab = SEARCH_TABS.find((t) => t.id === searchType)!;

  const activeCredits = credits.filter((c) => c.credit_status === "active");
  const usedCredits = credits.filter((c) => c.credit_status === "used");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />

      <main className="pt-24 pb-20">
        {/* Page Header */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/homepage"
              className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <AppIcon name="ArrowLeftIcon" size={14} />
              Back to Home
            </Link>
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">
              Booking Query
            </h1>
            <p className="text-[#A09890] mt-2 text-sm">
              Lookup any Credit(s) you might have using your reference number, email address, or cellphone number.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8">
          {/* Search Panel */}
          {!searched && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 mb-8">
              {/* Search type tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {SEARCH_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setSearchType(tab.id); setInputValue(""); setError(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      searchType === tab.id
                        ? "bg-[#C4622D] text-white"
                        : "bg-[#1A1A1A] text-[#A09890] hover:text-white border border-[#2A2A2A] hover:border-[#3A3A3A]"
                    }`}
                  >
                    <AppIcon name={tab.icon} size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Icon + description */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#C4622D]/15 flex items-center justify-center">
                  <AppIcon name={currentTab.icon} size={20} className="text-[#C4622D]" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-white">
                    Search by {currentTab.label}
                  </h2>
                  <p className="text-xs text-[#A09890]">
                    {searchType === "reference" && "Enter the booking reference number from your confirmation email"}
                    {searchType === "email" && "Enter the email address used when making your booking"}
                    {searchType === "cellphone" && "Enter the cellphone number used when making your booking"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSearch} className="flex gap-3">
                <input
                  type={searchType === "email" ? "email" : "text"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={currentTab.placeholder}
                  required
                  className="flex-1 bg-[#1A1A1A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#C4622D] transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  {loading ? "Searching…" : "Find Bookings"}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-sm text-red-400 flex items-center gap-2">
                  <AppIcon name="ExclamationCircleIcon" size={14} />
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#A09890] text-sm">Searching for your bookings…</p>
            </div>
          )}

          {/* Results */}
          {searched && !loading && (
            <>
              {/* ── Booking Credits Section ── */}
              {credits.length > 0 && (
                <div className="mb-8">
                  {/* Credits Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <AppIcon name="BanknotesIcon" size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-white">Booking Credits</h2>
                      <p className="text-xs text-[#A09890]">Credits issued as a result of no-show bookings</p>
                    </div>
                    {activeCredits.length > 0 && (
                      <span className="ml-auto text-xs px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                        {activeCredits.length} Active
                      </span>
                    )}
                  </div>

                  {/* Active Credits */}
                  {activeCredits.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {activeCredits.map((credit) => {
                        const isExpanded = expandedCreditId === credit.id;
                        return (
                          <div
                            key={credit.id}
                            className="bg-[#141414] border border-amber-500/25 rounded-2xl overflow-hidden"
                          >
                            {/* Credit Header */}
                            <div className="p-5 md:p-6">
                              <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs text-amber-400 font-mono font-semibold">
                                      {credit.original_booking_ref}
                                    </span>
                                    <span className="text-[#333]">·</span>
                                    <span className="text-xs text-[#666]">
                                      Issued {formatDate(credit.issued_at)}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium capitalize">
                                      {credit.booking_type === "class" ? "Cooking Class" : "Event"}
                                    </span>
                                  </div>
                                  <p className="text-sm text-white font-medium">{credit.customer_name}</p>
                                  <p className="text-xs text-[#666]">{credit.customer_email}</p>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-[#666] mb-0.5">Available Balance</p>
                                    <p className="text-xl font-bold text-amber-400">
                                      {formatCurrency(credit.remaining_balance)}
                                    </p>
                                  </div>
                                  <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/15 text-green-300 border border-green-500/30 font-medium">
                                    Active
                                  </span>
                                  <button
                                    onClick={() => setExpandedCreditId(isExpanded ? null : credit.id)}
                                    className="flex items-center gap-1 text-[#A09890] hover:text-white transition-colors text-xs"
                                  >
                                    <AppIcon name={isExpanded ? "ChevronUpIcon" : "ChevronDownIcon"} size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Credit Details */}
                            {isExpanded && (
                              <div className="border-t border-[#222] px-5 md:px-6 py-5">
                                {/* Credit Summary */}
                                <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                                  Credit Summary
                                </h4>
                                <div className="bg-[#0F0F0F] rounded-xl p-4 mb-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-[#666] mb-1">Total Issued</p>
                                    <p className="text-sm font-semibold text-white">{formatCurrency(credit.total_issued)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666] mb-1">Total Used</p>
                                    <p className="text-sm font-semibold text-white">{formatCurrency(credit.total_used)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666] mb-1">Remaining</p>
                                    <p className="text-sm font-semibold text-amber-400">{formatCurrency(credit.remaining_balance)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666] mb-1">Issued On</p>
                                    <p className="text-sm text-[#A09890]">{formatDateTime(credit.issued_at)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666] mb-1">Original Booking</p>
                                    <p className="text-sm font-mono text-[#C4622D]">{credit.original_booking_ref}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666] mb-1">Booking Type</p>
                                    <p className="text-sm text-[#A09890] capitalize">
                                      {credit.booking_type === "class" ? "Cooking Class" : "Event"}
                                    </p>
                                  </div>
                                </div>

                                {/* Notes */}
                                {credit.notes && (
                                  <div className="flex items-start gap-2 mb-5">
                                    <AppIcon name="InformationCircleIcon" size={14} className="text-[#666] mt-0.5 shrink-0" />
                                    <p className="text-xs text-[#A09890]">{credit.notes}</p>
                                  </div>
                                )}

                                {/* Usage History */}
                                {credit.transactions.length > 0 ? (
                                  <>
                                    <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                                      Usage History
                                    </h4>
                                    <div className="space-y-2 mb-2">
                                      {credit.transactions.map((tx) => (
                                        <div
                                          key={tx.id}
                                          className="bg-[#0F0F0F] rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                              <span className="text-xs font-mono font-semibold text-[#C4622D]">
                                                {tx.booking_ref}
                                              </span>
                                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1E1E] text-[#A09890] border border-[#2A2A2A] capitalize">
                                                {tx.booking_type === "class" ? "Cooking Class" : "Event"}
                                              </span>
                                            </div>
                                            <p className="text-xs text-[#666]">
                                              Applied on {formatDateTime(tx.applied_at)}
                                            </p>
                                            {tx.notes && (
                                              <p className="text-xs text-[#555] mt-0.5">{tx.notes}</p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                              <p className="text-xs text-[#666]">Applied</p>
                                              <p className="text-sm font-semibold text-red-400">
                                                -{formatCurrency(tx.amount_applied)}
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs text-[#666]">Balance After</p>
                                              <p className="text-sm font-semibold text-[#A09890]">
                                                {formatCurrency(tx.balance_after)}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <div className="bg-[#0F0F0F] rounded-xl px-4 py-3 flex items-center gap-2">
                                    <AppIcon name="CheckCircleIcon" size={14} className="text-green-400 shrink-0" />
                                    <p className="text-xs text-[#A09890]">This credit has not been used yet — full balance available.</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Used Credits (collapsed by default) */}
                  {usedCredits.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-[#555] uppercase tracking-wider font-semibold">Used Credits</p>
                      {usedCredits.map((credit) => {
                        const isExpanded = expandedCreditId === credit.id;
                        return (
                          <div
                            key={credit.id}
                            className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden opacity-70"
                          >
                            <div className="p-5 md:p-6">
                              <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs text-[#666] font-mono font-semibold">
                                      {credit.original_booking_ref}
                                    </span>
                                    <span className="text-[#333]">·</span>
                                    <span className="text-xs text-[#555]">
                                      Issued {formatDate(credit.issued_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-[#A09890] font-medium">{credit.customer_name}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-[#555] mb-0.5">Issued</p>
                                    <p className="text-base font-bold text-[#666]">
                                      {formatCurrency(credit.total_issued)}
                                    </p>
                                  </div>
                                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 font-medium">
                                    Fully Used
                                  </span>
                                  <button
                                    onClick={() => setExpandedCreditId(isExpanded ? null : credit.id)}
                                    className="flex items-center gap-1 text-[#555] hover:text-white transition-colors text-xs"
                                  >
                                    <AppIcon name={isExpanded ? "ChevronUpIcon" : "ChevronDownIcon"} size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-[#1E1E1E] px-5 md:px-6 py-5">
                                <h4 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">
                                  Usage History
                                </h4>
                                {credit.transactions.length > 0 ? (
                                  <div className="space-y-2">
                                    {credit.transactions.map((tx) => (
                                      <div
                                        key={tx.id}
                                        className="bg-[#0F0F0F] rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <span className="text-xs font-mono font-semibold text-[#666]">
                                              {tx.booking_ref}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[#555] border border-[#222] capitalize">
                                              {tx.booking_type === "class" ? "Cooking Class" : "Event"}
                                            </span>
                                          </div>
                                          <p className="text-xs text-[#555]">
                                            Applied on {formatDateTime(tx.applied_at)}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                          <div className="text-right">
                                            <p className="text-xs text-[#555]">Applied</p>
                                            <p className="text-sm font-semibold text-[#666]">
                                              -{formatCurrency(tx.amount_applied)}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-[#555]">Balance After</p>
                                            <p className="text-sm font-semibold text-[#555]">
                                              {formatCurrency(tx.balance_after)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-[#555]">No transaction records found.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Bookings Section ── */}
              {bookings.length === 0 && credits.length === 0 ? (
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] flex items-center justify-center mx-auto mb-4">
                    <AppIcon name="CalendarDaysIcon" size={28} className="text-[#555]" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-white mb-2">No bookings found</h3>
                  <p className="text-[#A09890] text-sm mb-6">
                    We couldn&apos;t find any bookings matching your search. Please check your details and try again.
                  </p>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors"
                  >
                    <AppIcon name="MagnifyingGlassIcon" size={16} />
                    Try Again
                  </button>
                </div>
              ) : bookings.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-[#A09890] text-sm mb-4">
                    {bookings.length} booking{bookings.length !== 1 ? "s" : ""} found
                  </p>

                  {bookings.map((booking) => {
                    const isExpanded = expandedId === booking.id;
                    const fullName = `${booking.title ? booking.title + " " : ""}${booking.first_name} ${booking.surname}`;

                    return (
                      <div
                        key={booking.id}
                        className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#3A3A3A]"
                      >
                        {/* Booking Header Row */}
                        <div className="p-5 md:p-6">
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            {/* Left: Ref + Date */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {booking.registration_code && (
                                  <span className="text-xs text-[#C4622D] font-mono font-semibold">
                                    {booking.registration_code}
                                  </span>
                                )}
                                <span className="text-[#333]">·</span>
                                <span className="text-xs text-[#666]">
                                  {formatDate(booking.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-white font-medium truncate">{fullName}</p>
                              <p className="text-xs text-[#666] truncate">{booking.email}</p>
                            </div>

                            {/* Middle: Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[booking.type]}`}>
                                {TYPE_LABELS[booking.type]}
                              </span>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_COLORS[booking.payment_status as PaymentStatus] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/30"}`}>
                                {PAYMENT_LABELS[booking.payment_status as PaymentStatus] ?? booking.payment_status}
                              </span>
                            </div>

                            {/* Right: Amount + Expand */}
                            <div className="flex items-center gap-3">
                              {booking.amount != null && (
                                <span className="text-lg font-bold text-white">
                                  {formatCurrency(booking.amount)}
                                </span>
                              )}
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                                className="flex items-center gap-1 text-[#A09890] hover:text-white transition-colors text-xs"
                              >
                                <AppIcon
                                  name={isExpanded ? "ChevronUpIcon" : "ChevronDownIcon"}
                                  size={16}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-[#222] px-5 md:px-6 py-5">
                            {/* Session Dates */}
                            {booking.session_dates && booking.session_dates.length > 0 && (
                              <>
                                <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                                  Booked Sessions
                                </h4>
                                <div className="space-y-2 mb-5">
                                  {booking.session_dates.map((sd) => (
                                    <div
                                      key={sd.id}
                                      className="flex items-start justify-between py-2 border-b border-[#1E1E1E] last:border-0 gap-3"
                                    >
                                      <div>
                                        {sd.event_name && (
                                          <p className="text-sm text-white font-medium">{sd.event_name}</p>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                          {sd.event_date && (
                                            <span className="text-xs text-[#A09890] flex items-center gap-1">
                                              <AppIcon name="CalendarDaysIcon" size={11} />
                                              {formatDate(sd.event_date)}
                                            </span>
                                          )}
                                          {(sd.start_time || sd.end_time) && (
                                            <span className="text-xs text-[#A09890] flex items-center gap-1">
                                              <AppIcon name="ClockIcon" size={11} />
                                              {formatTime(sd.start_time)}
                                              {sd.end_time ? ` – ${formatTime(sd.end_time)}` : ""}
                                            </span>
                                          )}
                                          {sd.location && (
                                            <span className="text-xs text-[#A09890] flex items-center gap-1">
                                              <AppIcon name="MapPinIcon" size={11} />
                                              {sd.location}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {sd.fee != null && (
                                        <span className="text-sm text-[#A09890] shrink-0">
                                          {formatCurrency(sd.fee)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {/* Contact Info */}
                            <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                              Contact Details
                            </h4>
                            <div className="bg-[#0F0F0F] rounded-xl p-4 mb-5 space-y-2">
                              <div className="flex items-center gap-2 text-sm text-[#A09890]">
                                <AppIcon name="UserCircleIcon" size={14} className="text-[#666] shrink-0" />
                                <span>{fullName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-[#A09890]">
                                <AppIcon name="EnvelopeIcon" size={14} className="text-[#666] shrink-0" />
                                <span>{booking.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-[#A09890]">
                                <AppIcon name="PhoneIcon" size={14} className="text-[#666] shrink-0" />
                                <span>{booking.cellphone}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-[#A09890]">
                                <AppIcon name="CreditCardIcon" size={14} className="text-[#666] shrink-0" />
                                <span className="capitalize">{booking.payment_method || "—"}</span>
                              </div>
                            </div>

                            {/* Notes */}
                            {booking.notes && (
                              <div className="flex items-start gap-2 mb-4">
                                <AppIcon name="ChatBubbleLeftIcon" size={14} className="text-[#666] mt-0.5 shrink-0" />
                                <p className="text-xs text-[#A09890]">{booking.notes}</p>
                              </div>
                            )}

                            {/* Registered Participants */}
                            {(() => {
                              const participants = filterFilledParticipants(booking.children);
                              if (participants.length === 0) return null;
                              return (
                                <>
                                  <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                                    Registered Participants
                                  </h4>
                                  <div className="bg-[#0F0F0F] rounded-xl overflow-hidden mb-5">
                                    {participants.map((p, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-3 px-4 py-3 border-b border-[#1E1E1E] last:border-0"
                                      >
                                        <span className="font-mono text-xs font-semibold text-[#C4622D] shrink-0 min-w-[80px]">
                                          {p.ticket_number || "—"}
                                        </span>
                                        <span className="text-sm text-[#A09890] truncate">
                                          {getParticipantName(p) || "—"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              );
                            })()}

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-2 flex-wrap">
                              <Link
                                href={booking.type === "cooking_class" ? "/cooking-classes" : "https://cardamomkitchen.co.za/events"}
                                className="flex items-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                              >
                                <AppIcon name="CalendarDaysIcon" size={14} />
                                {booking.type === "cooking_class" ? "View Classes" : "View Events"}
                              </Link>
                              <button
                                onClick={handleReset}
                                className="flex items-center gap-2 bg-[#1E1E1E] hover:bg-[#252525] text-[#A09890] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              >
                                <AppIcon name="MagnifyingGlassIcon" size={14} />
                                New Search
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Search again */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleReset}
                  className="text-sm text-[#A09890] hover:text-white transition-colors underline underline-offset-2"
                >
                  Search with different details
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
