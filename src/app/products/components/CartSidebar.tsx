"use client";

import { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { useCart } from "./CartContext";
import type { VoucherData } from "./CartContext";
import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";


type CheckoutStep = "cart" | "details" | "payment" | "eft-success" | "confirmation";

type PaymentMethod = "eft" | "payfast" | "voucher";

const BANK_DETAILS = {
  bank: "Capitec Business",
  accountName: APP_NAME,
  accountNumber: "1051471249",
  branchCode: "450105",
};

export default function CartSidebar() {
  const { items, removeItem, updateQty, subtotal, totalItems, isOpen, setIsOpen, clearCart, appliedVoucher, setAppliedVoucher } = useCart();
  const supabase = createClient();
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

  // Voucher state
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
  const [voucherError, setVoucherError] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [showVoucherSection, setShowVoucherSection] = useState(false);

  const tax = subtotal * 0.15;
  const delivery = subtotal > 0 ? 15 : 0;
  const total = subtotal + tax + delivery;

  const handleValidateVoucher = async () => {
    setVoucherError("");
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      setVoucherError("Please enter a voucher code.");
      return;
    }
    setVoucherLoading(true);
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("voucher_code, customer_name, customer_email, total_meals, meals_remaining, status, package_type")
        .eq("voucher_code", code)
        .single();

      if (error || !data) {
        setVoucherError("Voucher code not found. Please check and try again.");
        return;
      }
      if (data.status === "unpaid") {
        setVoucherError(
          "This voucher has not been paid for yet. Please complete your payment at the Gift a Voucher page before placing an order."
        );
        return;
      }
      if (data.status !== "active" && data.status !== "paid") {
        setVoucherError(`This voucher is ${data.status}. It cannot be used.`);
        return;
      }
      if (data.meals_remaining <= 0) {
        setVoucherError("This voucher has no meals remaining.");
        return;
      }

      // Check if any cart items belong to a different package tier
      const vPkg = data.package_type || "none";
      const mismatchedItems = items.filter((i) => {
        const iPkg = i.product.packageType || "none";
        if (iPkg === "none") return false; // non-package items are fine
        return iPkg !== vPkg;
      });
      if (mismatchedItems.length > 0) {
        const labels: Record<string, string> = {
          "package-6": "6-Meal Package",
          "package-12": "12-Meal Package",
          "package-24": "24-Meal Package",
        };
        setVoucherError(
          `Your cart contains items from a different package tier. This voucher is for the ${labels[vPkg] || vPkg}. Please remove mismatched items first.`
        );
        return;
      }

      const voucherResult = data as VoucherData;
      setVoucherData(voucherResult);
      setVoucherApplied(true);
      setAppliedVoucher(voucherResult);
      setSelectedMethod("voucher");
      // Pre-fill name and email from voucher
      setForm((prev) => ({
        ...prev,
        name: prev.name || data.customer_name,
        email: prev.email || data.customer_email,
      }));
    } catch {
      setVoucherError("Failed to validate voucher. Please try again.");
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherData(null);
    setVoucherApplied(false);
    setVoucherCode("");
    setVoucherError("");
    setAppliedVoucher(null);
    if (selectedMethod === "voucher") setSelectedMethod("eft");
  };

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

  const handleVoucherOrder = async () => {
    if (!voucherData) return;
    setProcessing(true);
    setPayError("");

    const mealsToDeduct = totalItems;
    if (mealsToDeduct > voucherData.meals_remaining) {
      setPayError(`Your voucher only has ${voucherData.meals_remaining} meal(s) remaining, but your cart has ${mealsToDeduct} item(s).`);
      setProcessing(false);
      return;
    }

    try {
      const ref = orderRef;

      // Create the order
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            category: i.product.category,
          })),
          subtotal,
          delivery_fee: delivery,
          total: 0,
          payment_status: "paid",
          payment_method: "voucher",
          event_date: form.date || null,
          delivery_address: form.address,
          notes: `Voucher: ${voucherData.voucher_code}. ${form.notes}`.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to place order. Please try again.");
      }

      const newRef = result.reference ?? ref;

      // Deduct meals from voucher
      const newRemaining = voucherData.meals_remaining - mealsToDeduct;
      const newStatus = newRemaining <= 0 ? "redeemed" : "active";

      await supabase
        .from("vouchers")
        .update({ meals_remaining: newRemaining, status: newStatus })
        .eq("voucher_code", voucherData.voucher_code);

      // Insert redemption record
      await supabase.from("voucher_redemptions").insert({
        voucher_code: voucherData.voucher_code,
        order_id: newRef,
        meals_used: mealsToDeduct,
        notes: `Order ${newRef} — ${mealsToDeduct} meal(s) redeemed`,
      });

      setOrderRef(newRef);
      clearCart();
      setStep("eft-success");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleEFTConfirm = async () => {
    setProcessing(true);
    setPayError("");

    try {
      const ref = orderRef;

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            category: i.product.category,
          })),
          subtotal,
          delivery_fee: delivery,
          total,
          payment_status: "awaiting_payment",
          payment_method: "eft",
          event_date: form.date || null,
          delivery_address: form.address,
          notes: form.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to place order. Please try again.");
      }

      setOrderRef(result.reference ?? ref);
      clearCart();
      setStep("eft-success");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // PayFast handler — submits to /api/payfast/initiate which returns an auto-submitting HTML page
  const handlePayFastCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setPayError("");

    try {
      const response = await fetch("/api/payfast/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          amount: total.toFixed(2),
          itemName: `${APP_NAME} Order`,
          itemDescription: `Event: ${form.date || "TBD"} | ${form.address || ""}`.trim(),
          items: items.map((i) => ({
            id: i.product.id,
            name: i.product.name,
            quantity: i.quantity,
            price: i.product.price,
            unit: i.product.unit,
            category: i.product.category,
          })),
          subtotal,
          deliveryFee: delivery,
          total,
          eventDate: form.date || "",
          deliveryAddress: form.address || "",
          notes: form.notes || "",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to initiate payment");
      }

      // The API returns an HTML page — write it into the current window to trigger auto-submit
      const html = await response.text();
      document.open();
      document.write(html);
      document.close();
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : "Failed to initiate payment. Please try again."
      );
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

              {/* ─── Voucher Section ─── */}
              {items.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden">
                  <button
                    onClick={() => setShowVoucherSection(!showVoucherSection)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="TicketIcon" size={15} className="text-[#C4622D]" />
                      <span>Have a Voucher?</span>
                    </div>
                    <Icon name={showVoucherSection ? "ChevronUpIcon" : "ChevronDownIcon"} size={14} className="text-[#B5ADA5]" />
                  </button>

                  {showVoucherSection && (
                    <div className="px-4 pb-4 border-t border-[#F0EBE3]">
                      {!voucherApplied ? (
                        <div className="pt-3 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={voucherCode}
                              onChange={(e) => {
                                setVoucherCode(e.target.value.toUpperCase());
                                setVoucherError("");
                              }}
                              placeholder="e.g. CK-2026-XXXX"
                              className="flex-1 bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] font-mono transition-colors"
                            />
                            <button
                              onClick={handleValidateVoucher}
                              disabled={voucherLoading}
                              className="bg-[#C4622D] text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-70 flex items-center gap-1.5"
                            >
                              {voucherLoading ? (
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                              ) : "Apply"}
                            </button>
                          </div>
                          {voucherError && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <Icon name="ExclamationCircleIcon" size={12} />
                              {voucherError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="pt-3">
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon name="CheckCircleIcon" size={14} className="text-green-600" />
                                <p className="text-xs font-semibold text-green-800">Voucher Applied!</p>
                              </div>
                              <p className="text-xs text-green-700 font-mono font-bold">{voucherData?.voucher_code}</p>
                              <p className="text-xs text-green-600 mt-0.5">
                                {voucherData?.meals_remaining} meal(s) remaining · {voucherData?.customer_name}
                              </p>
                            </div>
                            <button
                              onClick={handleRemoveVoucher}
                              className="text-green-500 hover:text-red-500 transition-colors flex-shrink-0"
                              aria-label="Remove voucher"
                            >
                              <Icon name="XMarkIcon" size={14} />
                            </button>
                          </div>
                          {totalItems > (voucherData?.meals_remaining ?? 0) && (
                            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                              <Icon name="ExclamationTriangleIcon" size={12} />
                              Cart has {totalItems} items but voucher only has {voucherData?.meals_remaining} remaining.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                  {voucherApplied && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Voucher Payment</span>
                      <span>✓ Applied</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-[#1A1612] text-base pt-2 border-t border-[#DDD5C8]">
                    <span>Total</span>
                    <span>{voucherApplied ? <span className="text-green-600">R0.00 (Voucher)</span> : `R${total.toFixed(2)}`}</span>
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
                  {voucherApplied ? "Your voucher will be redeemed on order confirmation" : "Full payment required to confirm booking"}
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
                    {voucherApplied ? "Voucher Payment" : "Total Due Now"}
                  </p>
                  <p className="text-2xl font-display font-semibold mb-1">
                    {voucherApplied ? "R0.00" : `R${total.toFixed(2)}`}
                  </p>
                  {voucherApplied && (
                    <p className="text-xs text-green-400 font-mono">Paid via voucher {voucherData?.voucher_code}</p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Icon name="BuildingLibraryIcon" size={18} className="text-[#D4A853]" />
                    <p className="text-sm text-white/60 font-mono tracking-widest">
                      {voucherApplied ? "Meal Voucher" : "Manual EFT"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Voucher payment — shown when voucher applied */}
              {voucherApplied && voucherData ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="TicketIcon" size={15} className="text-green-600" />
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">Voucher Details</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "Voucher Code", value: voucherData.voucher_code },
                      { label: "Customer", value: voucherData.customer_name },
                      { label: "Meals Remaining", value: `${voucherData.meals_remaining} meals` },
                      { label: "Items in Cart", value: `${totalItems} item(s)` },
                      { label: "After Redemption", value: `${Math.max(0, voucherData.meals_remaining - totalItems)} meals` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-green-100 last:border-0">
                        <span className="text-green-700 text-xs">{label}</span>
                        <span className="font-semibold text-green-900 text-xs">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Payment Method Selection — only shown when no voucher */
                <div>
                  <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">
                    Select Payment Method
                  </p>
                  <div className="space-y-2">

                    {/* Manual EFT */}
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
                        <p className="text-xs text-[#8C8278]">Bank transfer to {APP_NAME}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        selectedMethod === "eft" ?"border-[#C4622D] bg-[#C4622D]" :"border-[#DDD5C8]"
                      }`}>
                        {selectedMethod === "eft" && (
                          <div className="w-full h-full rounded-full bg-white scale-50" />
                        )}
                      </div>
                    </button>

                    {/* PayFast */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod("payfast")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        selectedMethod === "payfast" ?"border-[#C4622D] bg-[#C4622D]/5" :"border-[#DDD5C8] bg-white hover:border-[#C4622D]/40"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedMethod === "payfast" ? "bg-[#C4622D] text-white" : "bg-[#EDE7DA] text-[#8C8278]"
                      }`}>
                        <Icon name="CreditCardIcon" size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${
                          selectedMethod === "payfast" ? "text-[#C4622D]" : "text-[#1A1612]"
                        }`}>PayFast</p>
                        <p className="text-xs text-[#8C8278]">Card, EFT, Instant EFT &amp; more</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        selectedMethod === "payfast" ?"border-[#C4622D] bg-[#C4622D]" :"border-[#DDD5C8]"
                      }`}>
                        {selectedMethod === "payfast" && (
                          <div className="w-full h-full rounded-full bg-white scale-50" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Bank Details — shown when EFT selected */}
              {selectedMethod === "eft" && !voucherApplied && (
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
                  <span className="text-[#C4622D]">{voucherApplied ? "R0.00 (Voucher)" : `R${total.toFixed(2)}`}</span>
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
              {voucherApplied ? (
                <>
                  <button
                    type="button"
                    onClick={handleVoucherOrder}
                    disabled={processing || totalItems > (voucherData?.meals_remaining ?? 0)}
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
                        <Icon name="TicketIcon" size={14} />
                        Confirm Voucher Order
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-[#B5ADA5] mt-3">
                    {totalItems} meal(s) will be deducted from your voucher balance
                  </p>
                </>
              ) : selectedMethod === "eft" ? (
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
                    onClick={handlePayFastCheckout}
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
                        <Icon name="CreditCardIcon" size={14} />
                        Pay via PayFast
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-[#B5ADA5] mt-3">
                    You will be redirected to PayFast&apos;s secure payment page
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
                  Thank you, {form.name || "valued customer"}! {voucherApplied ? "Your order has been confirmed using your meal voucher." : "Your order has been reserved and is awaiting your EFT payment."}
                </p>
              </div>
            </div>

            {/* Order Reference */}
            <div className="bg-[#C4622D]/10 border border-[#C4622D]/30 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-1">Order Reference</p>
              <p className="text-xl font-mono font-bold text-[#C4622D]">{orderRef}</p>
              {voucherApplied && (
                <p className="text-xs text-[#8C8278] mt-1">Paid via voucher {voucherData?.voucher_code}</p>
              )}
            </div>

            {/* Bank Details Summary — only for EFT */}
            {!voucherApplied && (
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
            )}

            {/* Voucher balance update */}
            {voucherApplied && voucherData && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="TicketIcon" size={15} className="text-green-600" />
                  <p className="text-xs font-semibold text-green-800">Voucher Updated</p>
                </div>
                <div className="space-y-1.5 text-xs text-green-700">
                  <div className="flex justify-between">
                    <span>Voucher Code</span>
                    <span className="font-mono font-bold">{voucherData.voucher_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Meals Used</span>
                    <span className="font-semibold">{totalItems > 0 ? totalItems : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Balance</span>
                    <span className="font-semibold">{Math.max(0, voucherData.meals_remaining - totalItems)} meals</span>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions — only for EFT */}
            {!voucherApplied && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon name="InformationCircleIcon" size={15} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-800">Payment Instructions</p>
                </div>
                <ul className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
                  <li>• Log in to your bank and make an EFT payment to the account above.</li>
                  <li>• Use <span className="font-bold">{orderRef}</span> as your payment reference.</li>
                  <li>• Your order will be confirmed once we receive your payment.</li>
                  <li>• A confirmation email will be sent to <span className="font-medium">{form.email}</span>{" "}
                    within 2 hours.
                  </li>
                </ul>
              </div>
            )}

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