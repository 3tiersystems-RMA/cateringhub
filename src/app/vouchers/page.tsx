"use client";

import { useState } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Icon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";


interface VoucherPackage {
  meals: number;
  price: number;
  label: string;
  description: string;
  popular?: boolean;
}

const PACKAGES: VoucherPackage[] = [
  {
    meals: 6,
    price: 690,
    label: "Starter Pack",
    description: "Perfect for trying out our packaged meals. 6 meals to use at your convenience.",
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

type Step = "select" | "details" | "confirmation";

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
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

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
      // Insert voucher with 'unpaid' status — becomes 'paid' only after payment is confirmed
      const { error } = await supabase.from("vouchers").insert({
        voucher_code: code,
        customer_name: form.name.trim(),
        customer_email: form.email.trim().toLowerCase(),
        customer_phone: stripped,
        total_meals: selectedPackage.meals,
        meals_remaining: selectedPackage.meals,
        status: "unpaid",
        notes: form.notes.trim() || null,
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

  const handlePayNow = async () => {
    if (!selectedPackage || !issuedCode) return;
    setPaymentLoading(true);
    setPaymentError("");

    try {
      const response = await fetch("/api/payfast/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/\D/g, ""),
          amount: selectedPackage.price.toFixed(2),
          itemName: `Meal Voucher — ${selectedPackage.label} (${selectedPackage.meals} meals)`,
          itemDescription: `Voucher code: ${issuedCode}`,
          // Pass voucher code in custom_str1 with VCHR- prefix so ITN can identify it
          voucherCode: issuedCode,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to initiate payment.");
      }

      // The response is an HTML page that auto-submits to PayFast
      const html = await response.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to initiate payment. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
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
        <section className="bg-gradient-to-br from-[#1A1612] to-[#3D342D] py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#C4622D]/20 border border-[#C4622D]/30 rounded-full px-4 py-1.5 mb-4">
              <Icon name="GiftIcon" size={14} className="text-[#C4622D]" />
              <span className="text-xs font-semibold text-[#C4622D] uppercase tracking-wider">Meal Vouchers</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              Gift a Meal Voucher
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PACKAGES.map((pkg) => (
                  <div
                    key={pkg.meals}
                    className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
                      pkg.popular ? "border-[#C4622D] shadow-md" : "border-[#DDD5C8]"
                    }`}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C4622D] text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
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
                      <p className="text-xl font-semibold text-[#1A1612] mt-1">R{pkg.price.toFixed(2)}</p>
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
                <p className="text-xl font-bold text-[#C4622D]">R{selectedPackage.price.toFixed(2)}</p>
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
                        Continue to Payment — R{selectedPackage.price.toFixed(2)}
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-[#B5ADA5]">
                    You will be redirected to PayFast to complete your payment securely.
                  </p>
                </form>
              </div>
            </div>
          )}

          {/* ─── STEP: CONFIRMATION (Awaiting Payment) ─── */}
          {step === "confirmation" && selectedPackage && (
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-8 text-center">
                {/* Pending payment icon */}
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CreditCardIcon" size={36} className="text-amber-600" />
                </div>
                <h2 className="font-display text-2xl font-bold text-[#1A1612] mb-2">
                  Voucher Reserved — Payment Required
                </h2>
                <p className="text-[#8C8278] text-sm mb-6">
                  Your meal voucher has been created. Save your unique code below — you will need it when placing orders.
                </p>

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
                      <span>R{selectedPackage.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment status warning */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-left mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="ExclamationTriangleIcon" size={15} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">Payment Required to Activate Voucher</p>
                  </div>
                  <ul className="text-xs text-amber-700 space-y-1 leading-relaxed">
                    <li>• Your voucher is currently <strong>unpaid</strong> and cannot be used at checkout.</li>
                    <li>• Click <strong>&quot;Pay Now&quot;</strong> below to complete your payment via PayFast.</li>
                    <li>• Once payment is confirmed, your voucher will be activated automatically.</li>
                    <li>• Save your code: <strong>{issuedCode}</strong></li>
                  </ul>
                </div>

                {/* Details */}
                <div className="bg-[#F5F0E8] rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                  {[
                    { label: "Name", value: form.name },
                    { label: "Email", value: form.email },
                    { label: "Total Meals", value: `${selectedPackage.meals} meals` },
                    { label: "Amount Due", value: `R${selectedPackage.price.toFixed(2)}` },
                    { label: "Status", value: "⏳ Awaiting Payment" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-[#DDD5C8] last:border-0">
                      <span className="text-[#8C8278] text-xs">{label}</span>
                      <span className="font-semibold text-[#1A1612] text-xs">{value}</span>
                    </div>
                  ))}
                </div>

                {paymentError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                    <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{paymentError}</p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handlePayNow}
                    disabled={paymentLoading}
                    className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {paymentLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Redirecting to PayFast...
                      </>
                    ) : (
                      <>
                        <Icon name="CreditCardIcon" size={14} />
                        Pay Now — R{selectedPackage.price.toFixed(2)}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setStep("select");
                      setSelectedPackage(null);
                      setForm({ name: "", email: "", phone: "", notes: "" });
                      setIssuedCode("");
                      setPaymentError("");
                    }}
                    className="w-full border border-[#DDD5C8] text-[#5C5347] py-3 rounded-full font-semibold text-sm hover:bg-[#F5F0E8] transition-all"
                  >
                    Purchase Another Voucher
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
