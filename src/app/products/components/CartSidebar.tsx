"use client";

import { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { useCart } from "./CartContext";
import { createClient } from "@/lib/supabase/client";

type CheckoutStep = "cart" | "details" | "payment" | "eft-success" | "confirmation";

type PaymentMethod = "eft" | "payfast";

const BANK_DETAILS = {
  bank: "Capitec Business",
  accountName: "Cardamom Kitchen",
  accountNumber: "1051471249",
  branchCode: "450105",
};

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
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("eft");
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [orderRef, setOrderRef] = useState("");

  const tax = subtotal * 0.15;
  const delivery = subtotal > 0 ? 15 : 0;
  const total = subtotal + tax + delivery;

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stripped = form.phone.replace(/\D/g, "");
    if (stripped.length !== 10) {
      setPhoneError("Mobile number must be exactly 10 digits");
      return;
    }
    if (stripped[0] !== "0") {
      setPhoneError("Mobile number must start with 0 (e.g. 0821234567)");
      return;
    }
    setPhoneError("");
    setOrderRef(`CK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`);
    setStep("payment");
  };

  const handleEFTConfirm = async () => {
    setProcessing(true);
    setPayError("");

    try {
      const supabase = createClient();
      const ref = orderRef;

      const { error } = await supabase.from("orders").insert({
        m_payment_id: ref,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        items: items.map((i) => ({
          id: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
          unit: i.product.unit,
        })),
        subtotal,
        delivery_fee: delivery,
        total,
        payment_status: "awaiting_payment",
        payment_method: "eft",
        event_date: form.date || null,
        delivery_address: form.address,
        notes: form.notes,
      });

      if (error) throw new Error(error.message);

      setOrderRef(ref);
      clearCart();
      setStep("eft-success");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // PayFast handler kept in code — button is inactive (coming soon)
  const handlePayFastCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    // PayFast integration coming soon — button is disabled
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
            {step !== "cart" && step !== "confirmation" && step !== "eft-success" && (
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
              {step === "eft-success" && "Order Placed!"}
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
        {step !== "confirmation" && step !== "eft-success" && (
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
                    Browse the menu &rarr;
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
                    <span>Tax (15%)</span>
                    <span>R{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-[#1A1612] text-base pt-2 border-t border-[#DDD5C8]">
                    <span>Total</span>
                    <span>R{total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setIsOpen(false); }}
                    className="w-full border border-[#C4622D] text-[#C4622D] py-3.5 rounded-full font-semibold text-sm hover:bg-[#F5EDE6] transition-all flex items-center justify-center gap-2"
                  >
                    Continue Shopping
                  </button>
                  <button
                    onClick={() => setStep("details")}
                    className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra hover:shadow-terra-lg flex items-center justify-center gap-2"
                  >
                    Enter your Details
                    <Icon name="ArrowRightIcon" size={16} />
                  </button>
                </div>
                <p className="text-xs text-center text-[#B5ADA5]">
                  Full payment required to confirm booking
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
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setForm({ ...form, phone: digits });
                      setPhoneError("");
                    }}
                    placeholder="0821234567"
                    maxLength={10}
                    className={`w-full bg-white border rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none transition-colors ${
                      phoneError ? "border-red-400 focus:border-red-500" : "border-[#DDD5C8] focus:border-[#C4622D]"
                    }`}
                  />
                  {phoneError && (
                    <p className="mt-1 text-xs text-red-500">{phoneError}</p>
                  )}
                  <p className="mt-1 text-xs text-[#B5ADA5]">Format: 0821234567</p>
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
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Payment summary card */}
              <div className="bg-gradient-to-br from-[#1A1612] to-[#3D342D] rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C4622D]/20 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#D4A853]/10 rounded-full translate-y-8 -translate-x-8" />
                <div className="relative z-10">
                  <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">
                    Total Due Now
                  </p>
                  <p className="text-2xl font-display font-semibold mb-1">
                    R{total.toFixed(2)}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <Icon name="BuildingLibraryIcon" size={18} className="text-[#D4A853]" />
                    <p className="text-sm text-white/60 font-mono tracking-widest">Manual EFT</p>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">
                  Select Payment Method
                </p>
                <div className="space-y-2">

                  {/* Manual EFT — Active */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("eft")}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      selectedMethod === "eft" ?"border-[#C4622D] bg-[#C4622D]/5" :"border-[#DDD5C8] bg-white hover:border-[#C4622D]/40"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedMethod === "eft" ? "bg-[#C4622D] text-white" : "bg-[#EDE7DA] text-[#8C8278]"
                    }`}>
                      <Icon name="BuildingLibraryIcon" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${
                        selectedMethod === "eft" ? "text-[#C4622D]" : "text-[#1A1612]"
                      }`}>Manual EFT</p>
                      <p className="text-xs text-[#8C8278]">Bank transfer to Cardamom Kitchen</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      selectedMethod === "eft" ?"border-[#C4622D] bg-[#C4622D]" :"border-[#DDD5C8]"
                    }`}>
                      {selectedMethod === "eft" && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </button>

                  {/* PayFast — Inactive / Coming Soon */}
                  <div className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-[#DDD5C8] bg-[#F5F0E8]/60 opacity-60 cursor-not-allowed">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#EDE7DA] text-[#B5ADA5]">
                      <Icon name="CreditCardIcon" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#B5ADA5]">PayFast</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#DDD5C8] text-[#8C8278] px-2 py-0.5 rounded-full">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-xs text-[#B5ADA5]">Card, EFT, Instant EFT &amp; more</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-[#DDD5C8] flex-shrink-0" />
                  </div>

                </div>
              </div>

              {/* Bank Details — shown when EFT selected */}
              {selectedMethod === "eft" && (
                <div className="bg-white border border-[#DDD5C8] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="BuildingLibraryIcon" size={15} className="text-[#C4622D]" />
                    <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Bank Details</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "Bank", value: BANK_DETAILS.bank },
                      { label: "Account Name", value: BANK_DETAILS.accountName },
                      { label: "Account Number", value: BANK_DETAILS.accountNumber },
                      { label: "Branch Code", value: BANK_DETAILS.branchCode },
                      { label: "Reference", value: orderRef || "Your Order Reference" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-[#F0EBE3] last:border-0">
                        <span className="text-[#8C8278] text-xs">{label}</span>
                        <span className="font-semibold text-[#1A1612] font-mono text-xs">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#8C8278] bg-[#F5F0E8] rounded-lg px-3 py-2 leading-relaxed">
                    ⚠️ Use your order reference as the payment reference. Your order will be confirmed once payment is received.
                  </p>
                </div>
              )}

              {/* Order total recap */}
              <div className="bg-[#EDE7DA] rounded-2xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between font-semibold text-[#1A1612]">
                  <span>Total Due Now</span>
                  <span className="text-[#C4622D]">R{total.toFixed(2)}</span>
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
              {selectedMethod === "eft" ? (
                <>
                  <button
                    type="button"
                    onClick={handleEFTConfirm}
                    disabled={processing}
                    className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <Icon name="BuildingLibraryIcon" size={14} />
                        Confirm EFT Order
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-[#B5ADA5] mt-3">
                    Your order will be reserved while we await your EFT payment
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full bg-[#B5ADA5] text-white py-3.5 rounded-full font-semibold text-sm cursor-not-allowed opacity-60 flex items-center justify-center gap-2"
                  >
                    <Icon name="LockClosedIcon" size={14} />
                    Pay via PayFast — Coming Soon
                  </button>
                  <p className="text-xs text-center text-[#B5ADA5] mt-3">
                    PayFast integration is coming soon. Please use Manual EFT.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP: EFT SUCCESS ─── */}
        {step === "eft-success" && (
          <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6">
            {/* Success icon */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <Icon name="CheckIcon" size={36} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-[#1A1612] mb-2">
                  Order Placed Successfully!
                </h3>
                <p className="text-[#8C8278] text-sm leading-relaxed">
                  Thank you, {form.name || "valued customer"}! Your order has been reserved and is awaiting your EFT payment.
                </p>
              </div>
            </div>

            {/* Order Reference */}
            <div className="bg-[#C4622D]/10 border border-[#C4622D]/30 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-1">Order Reference</p>
              <p className="text-xl font-mono font-bold text-[#C4622D]">{orderRef}</p>
              <p className="text-xs text-[#8C8278] mt-1">Use this as your payment reference</p>
            </div>

            {/* Bank Details Summary */}
            <div className="bg-white border border-[#DDD5C8] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="BuildingLibraryIcon" size={15} className="text-[#C4622D]" />
                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Bank Details</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Bank", value: BANK_DETAILS.bank },
                  { label: "Account Name", value: BANK_DETAILS.accountName },
                  { label: "Account Number", value: BANK_DETAILS.accountNumber },
                  { label: "Branch Code", value: BANK_DETAILS.branchCode },
                  { label: "Reference", value: orderRef },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-[#F0EBE3] last:border-0">
                    <span className="text-[#8C8278] text-xs">{label}</span>
                    <span className="font-semibold text-[#1A1612] font-mono text-xs">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="InformationCircleIcon" size={15} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800">Payment Instructions</p>
              </div>
              <ul className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
                <li>• Log in to your bank and make an EFT payment to the account above.</li>
                <li>• Use <span className="font-bold">{orderRef}</span> as your payment reference.</li>
                <li>• Your order will be confirmed once we receive your payment.</li>
                <li>• A confirmation email will be sent to <span className="font-medium">{form.email}</span>.</li>
              </ul>
            </div>

            <button
              onClick={() => { setIsOpen(false); setStep("cart"); }}
              className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all"
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* ─── STEP: CONFIRMATION (fallback) ─── */}
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
                <span className="text-[#8C8278]">Payment</span>
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