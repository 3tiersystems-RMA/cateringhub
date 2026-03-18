"use client";

import { useState } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Icon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";

interface VoucherPackage {
  meals: number;
  price: number;
  label: string;
  description: string;
  popular?: boolean;
  badge?: string;
}

const PACKAGES: VoucherPackage[] = [
  {
    meals: 6,
    price: 690,
    label: "Starter Pack",
    description: "Perfect for trying out our packaged meals. 6 meals to use at your convenience.",
  },
  {
    meals: 10,
    price: 1350,
    label: "10-Package Meal",
    description: "Health conscious option with a 2 week rotation. Nutritionist designed for a balanced lifestyle.",
    badge: "Nutritionist Designed",
  },
  {
    meals: 12,
    price: 1320,
    label: "Family Pack",
    description: "Our most popular option. 12 meals for the whole family over multiple weeks.",
    popular: true,
  },
  {
    meals: 24,
    price: 2520,
    label: "Bulk Pack",
    description: "Best value for regular customers. 24 meals with maximum savings.",
  },
];

const BANK_DETAILS = {
  bank: "Capitec Business",
  accountName: APP_NAME,
  accountNumber: "1051471249",
  branchCode: "450105",
};

const formatPrice = (amount: number): string =>
  `R ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Step = "select" | "details" | "confirmation" | "eft-pending";

function generateVoucherCode(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const rand2 = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `CK-${year}-${rand}${rand2}`;
}

export default function VouchersPage() {
  const supabase = createClient();
  const [step, setStep] = useState<Step>("select");
  const [selectedPackage, setSelectedPackage] = useState<VoucherPackage | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [eftConfirming, setEftConfirming] = useState(false);
  const [eftConfirmed, setEftConfirmed] = useState(false);

  const handleSelectPackage = (pkg: VoucherPackage) => {
    setSelectedPackage(pkg);
    setStep("details");
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    setSubmitError("");

    const stripped = form.phone.replace(/\D/g, "");
    if (stripped.length !== 10) {
      setPhoneError("Mobile number must be exactly 10 digits");
      return;
    }
    if (stripped[0] !== "0") {
      setPhoneError("Mobile number must start with 0 (e.g. 0821234567)");
      return;
    }

    if (!selectedPackage) return;

    setSubmitting(true);
    try {
      const code = generateVoucherCode();
      // Insert voucher with 'unpaid' status — becomes 'paid' only after staff verification
      // Map total_meals to package_type
      const pkgTypeMap: Record<number, string> = { 6: "package-6", 10: "package-10", 12: "package-12", 24: "package-24" };
      const { error } = await supabase.from("vouchers").insert({
        voucher_code: code,
        customer_name: form.name.trim(),
        customer_email: form.email.trim().toLowerCase(),
        customer_phone: stripped,
        total_meals: selectedPackage.meals,
        meals_remaining: selectedPackage.meals,
        status: "unpaid",
        notes: form.notes.trim() || null,
        package_type: pkgTypeMap[selectedPackage.meals] || "none",
      });

      if (error) {
        throw new Error(error.message);
      }

      setIssuedCode(code);
      setStep("confirmation");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create voucher. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEftConfirm = async () => {
    setEftConfirming(true);
    // Voucher is already inserted as 'unpaid' — staff will mark it as 'paid' after verifying EFT
    // Just transition to the eft-pending confirmation screen
    await new Promise((r) => setTimeout(r, 600)); // brief UX delay
    setEftConfirmed(true);
    setEftConfirming(false);
    setStep("eft-pending");
  };

  const handleCopyCode = () => {
    if (!issuedCode) return;
    navigator.clipboard.writeText(issuedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-[#F5F0E8]">
        {/* Hero */}
        <section className="bg-black py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#C4622D]/20 border border-[#C4622D]/30 rounded-full px-4 py-1.5 mb-4">
              <Icon name="GiftIcon" size={14} className="text-[#C4622D]" />
              <span className="text-xs font-semibold text-[#C4622D] uppercase tracking-wider">Meal Vouchers</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
Purchase a Meal Voucher
            </h1>
            <p className="text-[#A09890] text-base leading-relaxed max-w-xl mx-auto">
              Purchase a packaged meal voucher upfront and redeem meals at your convenience. 
              Perfect for gifting or planning ahead.
            </p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 py-12">

          {/* ─── STEP: SELECT PACKAGE ─── */}
          {step === "select" && (
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#1A1612] text-center mb-2">
                Choose Your Package
              </h2>
              <p className="text-[#8C8278] text-sm text-center mb-8">
                All packages include chef-crafted meals. Each portion typically feeds 2 adults.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {PACKAGES.map((pkg) => (
                  <div
                    key={pkg.meals}
                    className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
                      pkg.popular ? "border-[#C4622D] shadow-md" : "border-[#DDD5C8]"
                    }`}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C4622D] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap text-center">
                        Most Popular
                      </div>
                    )}
                    {pkg.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4A7C59] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                        {pkg.badge}
                      </div>
                    )}
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-[#F5F0E8] flex items-center justify-center mx-auto mb-3">
                        <Icon name="TicketIcon" size={26} className="text-[#C4622D]" />
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#1A1612]">{pkg.label}</h3>
                      <p className="text-3xl font-bold text-[#C4622D] mt-1">
                        {pkg.meals} <span className="text-base font-medium text-[#8C8278]">meals</span>
                      </p>
                      <p className="text-xl font-semibold text-[#1A1612] mt-1">{formatPrice(pkg.price)}</p>
                      <p className="text-xs text-[#8C8278] mt-0.5">
                        R{(pkg.price / pkg.meals).toFixed(2)} per meal
                      </p>
                    </div>
                    <p className="text-sm text-[#5C5347] text-center leading-relaxed">{pkg.description}</p>
                    <button
                      className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${
                        pkg.popular
                          ? "bg-[#C4622D] text-white hover:bg-[#A04E22]"
                          : "bg-[#F5F0E8] text-[#C4622D] hover:bg-[#EDE7DA] border border-[#C4622D]/30"
                      }`}
                    >
                      Select Package
                    </button>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="mt-12 bg-white rounded-2xl border border-[#DDD5C8] p-6">
                <h3 className="font-display text-lg font-semibold text-[#1A1612] mb-4 text-center">
                  How Vouchers Work
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: "ShoppingBagIcon", title: "1. Purchase", desc: "Choose a package and complete your details. A unique voucher code is generated instantly." },
                    { icon: "TicketIcon", title: "2. Save Your Code", desc: "Your voucher code (e.g. CK-2026-XXXX) is your key. Save it — you'll need it at checkout." },
                    { icon: "CheckCircleIcon", title: "3. Redeem", desc: "Enter your code at checkout. Each order deducts from your balance until all meals are used." },
                  ].map((item) => (
                    <div key={item.title} className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[#F5F0E8] flex items-center justify-center">
                        <Icon name={item.icon as any} size={18} className="text-[#C4622D]" />
                      </div>
                      <p className="font-semibold text-[#1A1612] text-sm">{item.title}</p>
                      <p className="text-xs text-[#8C8278] leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: DETAILS ─── */}
          {step === "details" && selectedPackage && (
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => setStep("select")}
                className="flex items-center gap-2 text-sm text-[#8C8278] hover:text-[#1A1612] mb-6 transition-colors"
              >
                <Icon name="ArrowLeftIcon" size={14} />
                Back to packages
              </button>

              {/* Selected package summary */}
              <div className="bg-[#C4622D]/10 border border-[#C4622D]/30 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#8C8278] font-medium">Selected Package</p>
                  <p className="font-display font-bold text-[#1A1612]">{selectedPackage.label} — {selectedPackage.meals} meals</p>
                </div>
                <p className="text-xl font-bold text-[#C4622D]">{formatPrice(selectedPackage.price)}</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-6">
                <h2 className="font-display text-xl font-semibold text-[#1A1612] mb-5">Your Details</h2>
                <form onSubmit={handleDetailsSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Jennifer Martinez"
                      className="w-full bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="jennifer@email.com"
                      className="w-full bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      value={form.phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setForm({ ...form, phone: digits });
                        setPhoneError("");
                      }}
                      placeholder="0821234567"
                      maxLength={10}
                      className={`w-full bg-[#F5F0E8] border rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none transition-colors ${
                        phoneError ? "border-red-400 focus:border-red-500" : "border-[#DDD5C8] focus:border-[#C4622D]"
                      }`}
                    />
                    {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
                    <p className="mt-1 text-xs text-[#B5ADA5]">Format: 0821234567</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                      Notes (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Any special instructions or notes..."
                      className="w-full bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
                    />
                  </div>

                  {submitError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{submitError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Preparing Voucher...
                      </>
                    ) : (
                      <>
                        <Icon name="TicketIcon" size={14} />
                        Continue to Payment — {formatPrice(selectedPackage.price)}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─── STEP: CONFIRMATION (EFT Banking Details) ─── */}
          {step === "confirmation" && selectedPackage && (
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-8">
                {/* Voucher code display */}
                <div className="bg-gradient-to-br from-[#1A1612] to-[#3D342D] rounded-2xl p-6 mb-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#C4622D]/20 rounded-full -translate-y-6 translate-x-6" />
                  <div className="absolute bottom-0 left-0 w-20 h-20 bg-[#D4A853]/10 rounded-full translate-y-6 -translate-x-6" />
                  <div className="relative z-10">
                    <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-2">Your Voucher Code</p>
                    <p className="text-3xl font-mono font-bold text-[#C4622D] tracking-widest mb-3">{issuedCode}</p>
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                      >
                        <Icon name={copied ? "CheckIcon" : "ClipboardDocumentIcon"} size={13} />
                        {copied ? "Copied!" : "Copy Code"}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-white/60 text-xs">
                      <span>{selectedPackage.meals} meals</span>
                      <span>·</span>
                      <span>{selectedPackage.label}</span>
                      <span>·</span>
                      <span>{formatPrice(selectedPackage.price)}</span>
                    </div>
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold text-[#1A1612] mb-1 text-center">
                  Complete Your EFT Payment
                </h2>
                <p className="text-[#8C8278] text-sm text-center mb-6 leading-relaxed">
                  Transfer the amount below to activate your voucher. Once we verify your payment, your voucher will be marked as paid.
                </p>

                {/* Banking Details */}
                <div className="bg-[#F5F0E8] border border-[#DDD5C8] rounded-2xl p-5 mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="BuildingLibraryIcon" size={15} className="text-[#C4622D]" />
                    <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Banking Details</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Bank", value: BANK_DETAILS.bank },
                      { label: "Account Name", value: BANK_DETAILS.accountName },
                      { label: "Account Number", value: BANK_DETAILS.accountNumber },
                      { label: "Branch Code", value: BANK_DETAILS.branchCode },
                      { label: "Amount", value: formatPrice(selectedPackage.price) },
                      { label: "Reference", value: issuedCode },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-[#DDD5C8] last:border-0">
                        <span className="text-[#8C8278] text-xs">{label}</span>
                        <span className={`font-semibold font-mono text-xs ${label === "Reference" ? "text-[#C4622D]" : "text-[#1A1612]"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="InformationCircleIcon" size={14} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">Payment Instructions</p>
                  </div>
                  <ul className="text-xs text-amber-700 space-y-1 leading-relaxed">
                    <li>• Use your voucher code <strong>{issuedCode}</strong> as the payment reference.</li>
                    <li>• Once we receive and verify your EFT, your voucher will be activated.</li>
                    <li>• You will not be able to place orders until your voucher is marked as paid.</li>
                  </ul>
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleEftConfirm}
                  disabled={eftConfirming}
                  className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mb-3"
                >
                  {eftConfirming ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Icon name="CheckCircleIcon" size={14} />
                      I Have Made Payment
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setStep("select");
                    setSelectedPackage(null);
                    setForm({ name: "", email: "", phone: "", notes: "" });
                    setIssuedCode("");
                  }}
                  className="w-full border border-[#DDD5C8] text-[#5C5347] py-3 rounded-full font-semibold text-sm hover:bg-[#F5F0E8] transition-all"
                >
                  Purchase Another Voucher
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP: EFT PENDING (Payment Submitted) ─── */}
          {step === "eft-pending" && selectedPackage && (
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-8 text-center">
                {/* Pending icon */}
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="ClockIcon" size={36} className="text-amber-600" />
                </div>
                <h2 className="font-display text-2xl font-bold text-[#1A1612] mb-2">
                  Payment Submitted
                </h2>
                <p className="text-[#8C8278] text-sm mb-6 leading-relaxed">
                  Thank you, {form.name}! We have noted your EFT payment. Once our team verifies the transfer, your voucher will be activated and you can start placing orders.
                </p>

                {/* Voucher code */}
                <div className="bg-gradient-to-br from-[#1A1612] to-[#3D342D] rounded-2xl p-5 mb-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-[#C4622D]/20 rounded-full -translate-y-4 translate-x-4" />
                  <div className="relative z-10">
                    <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-2">Your Voucher Code</p>
                    <p className="text-2xl font-mono font-bold text-[#C4622D] tracking-widest mb-3">{issuedCode}</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                      >
                        <Icon name={copied ? "CheckIcon" : "ClipboardDocumentIcon"} size={13} />
                        {copied ? "Copied!" : "Copy Code"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[#F5F0E8] rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                  {[
                    { label: "Name", value: form.name },
                    { label: "Email", value: form.email },
                    { label: "Package", value: `${selectedPackage.label} — ${selectedPackage.meals} meals` },
                    { label: "Amount Paid", value: formatPrice(selectedPackage.price) },
                    { label: "Status", value: "⏳ Awaiting Verification" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-[#DDD5C8] last:border-0">
                      <span className="text-[#8C8278] text-xs">{label}</span>
                      <span className="font-semibold text-[#1A1612] text-xs">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="InformationCircleIcon" size={14} className="text-blue-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-blue-800">What happens next?</p>
                  </div>
                  <ul className="text-xs text-blue-700 space-y-1 leading-relaxed">
                    <li>• Our staff will verify your EFT payment.</li>
                    <li>• Once confirmed, your voucher status will be updated to <strong>Paid</strong>.</li>
                    <li>• You can then use your code <strong>{issuedCode}</strong> at checkout.</li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setStep("select");
                    setSelectedPackage(null);
                    setForm({ name: "", email: "", phone: "", notes: "" });
                    setIssuedCode("");
                    setEftConfirmed(false);
                  }}
                  className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all"
                >
                  Purchase Another Voucher
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
