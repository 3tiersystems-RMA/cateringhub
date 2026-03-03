"use client";

import { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { useCart } from "./CartContext";

type CheckoutStep = "cart" | "details" | "payment" | "confirmation";

type PaymentMethod = "all" | "cc" | "ef" | "eft";

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: "all", label: "All Methods", description: "Card, EFT, Instant EFT & more", icon: "CreditCardIcon" },
  { id: "cc", label: "Credit / Debit Card", description: "Visa, Mastercard, Amex", icon: "CreditCardIcon" },
  { id: "ef", label: "EFT", description: "Electronic Funds Transfer", icon: "BanknotesIcon" },
  { id: "eft", label: "Instant EFT", description: "Pay instantly via your bank", icon: "BoltIcon" },
];

export default function CartSidebar() {
  const { items, removeItem, updateQty, subtotal, totalItems, isOpen, setIsOpen, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>("cart");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    address: "",
    notes: "",
  });
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("all");
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState("");

  const tax = subtotal * 0.08;
  const delivery = subtotal > 0 ? 15 : 0;
  const total = subtotal + tax + delivery;
  const deposit = total * 0.25;

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("payment");
  };

  const handlePayFastCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setPayError("");

    try {
      const itemNames = items.map((i) => `${i.product.name} x${i.quantity}`).join(", ");

      const res = await fetch("/api/payfast/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          amount: deposit.toFixed(2),
          itemName: "CateringHub Deposit",
          itemDescription: itemNames.slice(0, 255),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      // Build and auto-submit the PayFast form
      const form_el = document.createElement("form");
      form_el.method = "POST";
      form_el.action = data.actionUrl;

      // Add payment method if not "all"
      if (selectedMethod !== "all") {
        const pmInput = document.createElement("input");
        pmInput.type = "hidden";
        pmInput.name = "payment_method";
        pmInput.value = selectedMethod;
        form_el.appendChild(pmInput);
      }

      Object.entries(data.formData as Record<string, string>).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form_el.appendChild(input);
      });

      document.body.appendChild(form_el);
      clearCart();
      form_el.submit();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment initiation failed. Please try again.");
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1612]/40 backdrop-blur-sm z-40"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="cart-panel fixed right-0 top-0 h-full w-full max-w-md bg-[#F5F0E8] z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#DDD5C8]">
          <div className="flex items-center gap-3">
            {step !== "cart" && step !== "confirmation" && (
              <button
                onClick={() => setStep(step === "payment" ? "details" : "cart")}
                className="p-1.5 rounded-lg hover:bg-[#EDE7DA] transition-colors mr-1"
                aria-label="Go back"
              >
                <Icon name="ArrowLeftIcon" size={16} className="text-[#5C5347]" />
              </button>
            )}
            <h2 className="font-display text-lg font-semibold text-[#1A1612]">
              {step === "cart" && `Order Summary (${totalItems})`}
              {step === "details" && "Event Details"}
              {step === "payment" && "Secure Payment"}
              {step === "confirmation" && "Order Confirmed!"}
            </h2>
          </div>
          <button
            onClick={() => { setIsOpen(false); setStep("cart"); }}
            className="p-2 rounded-full hover:bg-[#EDE7DA] transition-colors"
            aria-label="Close cart"
          >
            <Icon name="XMarkIcon" size={18} className="text-[#5C5347]" />
          </button>
        </div>

        {/* Progress Steps */}
        {step !== "confirmation" && (
          <div className="px-6 py-3 border-b border-[#DDD5C8] flex items-center gap-2">
            {(["cart", "details", "payment"] as CheckoutStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    s === step
                      ? "bg-[#C4622D] text-white"
                      : (["cart", "details", "payment"].indexOf(step) > i)
                      ? "bg-[#1A1612] text-white" : "bg-[#EDE7DA] text-[#8C8278]"
                  }`}
                >
                  {(["cart", "details", "payment"].indexOf(step) > i) ? (
                    <Icon name="CheckIcon" size={12} />
                  ) : i + 1}
                </div>
                <span className={`text-xs font-medium capitalize ${s === step ? "text-[#C4622D]" : "text-[#B5ADA5]"}`}>
                  {s === "cart" ? "Cart" : s === "details" ? "Details" : "Payment"}
                </span>
                {i < 2 && <div className="w-4 h-px bg-[#DDD5C8]" />}
              </div>
            ))}
          </div>
        )}

        {/* ─── STEP: CART ─── */}
        {step === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#EDE7DA] flex items-center justify-center">
                    <Icon name="ShoppingCartIcon" size={28} className="text-[#B5ADA5]" />
                  </div>
                  <p className="text-[#8C8278] text-sm">Your cart is empty.</p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-xs font-semibold text-[#C4622D] hover:underline"
                  >
                    Browse the menu →
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex gap-3 bg-white rounded-2xl p-3 border border-[#DDD5C8]"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#EDE7DA]">
                      <AppImage
                        src={item.product.image}
                        alt={item.product.imageAlt}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1612] line-clamp-1">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-[#8C8278] font-mono">{item.product.unit}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 bg-[#EDE7DA] rounded-full px-2 py-1">
                          <button
                            onClick={() => updateQty(item.product.id, item.quantity - 1)}
                            className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-[#C4622D] hover:text-white transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Icon name="MinusIcon" size={10} />
                          </button>
                          <span className="text-xs font-semibold text-[#1A1612] w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.product.id, item.quantity + 1)}
                            className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-[#C4622D] hover:text-white transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Icon name="PlusIcon" size={10} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A1612]">
                            R{(item.product.price * item.quantity).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="p-1 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors text-[#B5ADA5]"
                            aria-label="Remove item"
                          >
                            <Icon name="TrashIcon" size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Order Summary */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-[#DDD5C8] space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[#5C5347]">
                    <span>Subtotal</span>
                    <span>R{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#5C5347]">
                    <span>Delivery</span>
                    <span>R{delivery.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#5C5347]">
                    <span>Tax (8%)</span>
                    <span>R{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-[#1A1612] text-base pt-2 border-t border-[#DDD5C8]">
                    <span>Total</span>
                    <span>R{total.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setStep("details")}
                  className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra hover:shadow-terra-lg flex items-center justify-center gap-2"
                >
                  Proceed to Details
                  <Icon name="ArrowRightIcon" size={16} />
                </button>
                <p className="text-xs text-center text-[#B5ADA5]">
                  25% deposit required to confirm booking
                </p>
              </div>
            )}
          </>
        )}

        {/* ─── STEP: DETAILS ─── */}
        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Jennifer Martinez"
                    className="w-full bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jennifer@email.com"
                    className="w-full bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="082 000 0000"
                    className="w-full bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                    Event / Delivery Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    min={new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                    Delivery Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Main St, Johannesburg, 2000"
                    className="w-full bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                    Special Requests / Dietary Notes
                  </label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Allergies, dietary restrictions, special setup instructions..."
                    className="w-full bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-5 border-t border-[#DDD5C8]">
              <button
                type="submit"
                className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra flex items-center justify-center gap-2"
              >
                Continue to Payment
                <Icon name="LockClosedIcon" size={14} />
              </button>
            </div>
          </form>
        )}

        {/* ─── STEP: PAYMENT ─── */}
        {step === "payment" && (
          <form onSubmit={handlePayFastCheckout} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Security badge */}
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <Icon name="ShieldCheckIcon" size={16} className="text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  256-bit SSL encrypted · Powered by PayFast · PCI DSS Compliant
                </p>
              </div>

              {/* Deposit summary card */}
              <div className="bg-gradient-to-br from-[#1A1612] to-[#3D342D] rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C4622D]/20 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#D4A853]/10 rounded-full translate-y-8 -translate-x-8" />
                <div className="relative z-10">
                  <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">
                    Deposit Due Now (25%)
                  </p>
                  <p className="text-2xl font-display font-semibold mb-1">
                    R{deposit.toFixed(2)}
                  </p>
                  <p className="text-xs text-white/40">
                    Balance of R{(total * 0.75).toFixed(2)} due at delivery
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-8 h-5 bg-[#D4A853] rounded-sm opacity-80" />
                    <p className="text-sm text-white/60 font-mono tracking-widest">PayFast</p>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">
                  Select Payment Method
                </p>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethod(method.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        selectedMethod === method.id
                          ? "border-[#C4622D] bg-[#C4622D]/5"
                          : "border-[#DDD5C8] bg-white hover:border-[#C4622D]/40"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedMethod === method.id ? "bg-[#C4622D] text-white" : "bg-[#EDE7DA] text-[#8C8278]"
                      }`}>
                        <Icon name={method.icon} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${
                          selectedMethod === method.id ? "text-[#C4622D]" : "text-[#1A1612]"
                        }`}>{method.label}</p>
                        <p className="text-xs text-[#8C8278]">{method.description}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        selectedMethod === method.id
                          ? "border-[#C4622D] bg-[#C4622D]"
                          : "border-[#DDD5C8]"
                      }`}>
                        {selectedMethod === method.id && (
                          <div className="w-full h-full rounded-full bg-white scale-50" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Order total recap */}
              <div className="bg-[#EDE7DA] rounded-2xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-[#5C5347]">
                  <span>Order Total</span>
                  <span>R{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-[#1A1612]">
                  <span>Deposit Due Now</span>
                  <span className="text-[#C4622D]">R{deposit.toFixed(2)}</span>
                </div>
              </div>

              {/* Error message */}
              {payError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600">{payError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-5 border-t border-[#DDD5C8]">
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Redirecting to PayFast...
                  </>
                ) : (
                  <>
                    <Icon name="LockClosedIcon" size={14} />
                    Pay R{deposit.toFixed(2)} via PayFast
                  </>
                )}
              </button>
              <p className="text-xs text-center text-[#B5ADA5] mt-3">
                You will be redirected to PayFast to complete your payment securely
              </p>
            </div>
          </form>
        )}

        {/* ─── STEP: CONFIRMATION (fallback, normally handled by /checkout/success) ─── */}
        {step === "confirmation" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="CheckIcon" size={36} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-semibold text-[#1A1612] mb-2">
                Booking Confirmed!
              </h3>
              <p className="text-[#8C8278] text-sm leading-relaxed">
                Thank you, {form.name || "valued customer"}! We&apos;ve received your order and will send a confirmation to{" "}
                <span className="text-[#C4622D] font-medium">{form.email || "your email"}</span>{" "}
                within 2 hours.
              </p>
            </div>
            <div className="w-full bg-[#EDE7DA] rounded-2xl p-5 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8C8278]">Order #</span>
                <span className="font-mono font-semibold text-[#1A1612]">
                  CH-{Math.random().toString(36).slice(2, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C8278]">Event Date</span>
                <span className="font-semibold text-[#1A1612]">{form.date || "TBD"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C8278]">Deposit Paid</span>
                <span className="font-semibold text-green-600">✓ Processed</span>
              </div>
            </div>
            <button
              onClick={() => { setIsOpen(false); setStep("cart"); }}
              className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all"
            >
              Back to Menu
            </button>
          </div>
        )}
      </aside>
    </>
  );
}