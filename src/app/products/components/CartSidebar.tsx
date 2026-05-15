"use client";

import { useState, useRef } from "react";
import Icon from "@/components/ui/AppIcon";
import { useCart } from "./CartContext";
import type { VoucherData, DiscountVoucherData } from "./CartContext";

import { createClient } from "@/lib/supabase/client";
import CartStepCart from "./CartStepCart";
import CartStepDetails from "./CartStepDetails";
import CartStepPayment from "./CartStepPayment";
import CartStepSuccess from "./CartStepSuccess";
import VoucherErrorModal from "@/components/ui/VoucherErrorModal";

type CheckoutStep = "cart" | "details" | "payment" | "eft-success" | "confirmation";
type PaymentMethod = "eft" | "voucher" | "payfast";

export default function CartSidebar() {
  const { items, subtotal, totalItems, isOpen, setIsOpen, clearCart } = useCart();
  const supabase = createClient();

  const [step, setStep] = useState<CheckoutStep>("cart");
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "", address: "", notes: "" });
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("eft");
  const [processing, setProcessing] = useState(false);
  const [payError, setPayErrorState] = useState("");
  const [phoneError, setPhoneErrorState] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const voucherOrderInProgress = useRef(false);

  // Global error modal
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string; title: string }>({ open: false, message: "", title: "Error" });
  const showError = (message: string, title = "Error") => setErrorModal({ open: true, message, title });
  const closeError = () => setErrorModal({ open: false, message: "", title: "Error" });

  // Wrapped setters that show modal instead of inline
  const setPayError = (msg: string) => { if (msg) showError(msg, "Payment Error"); else setPayErrorState(""); };
  const setPhoneError = (msg: string) => { if (msg) showError(msg, "Phone Number Error"); else setPhoneErrorState(""); };
  const setVoucherError = (msg: string) => { if (msg) showError(msg, "Voucher Error"); };
  const setDvError = (msg: string) => { if (msg) showError(msg, "Discount Voucher Error"); };

  // Meal Voucher state
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [showVoucherSection, setShowVoucherSection] = useState(false);
  const [voucherMealsUsed, setVoucherMealsUsed] = useState(0);
  const [voucherMealsRemaining, setVoucherMealsRemaining] = useState(0);

  // Discount Voucher state
  const [dvCode, setDvCode] = useState("");
  const [dvData, setDvData] = useState<DiscountVoucherData | null>(null);
  const [dvLoading, setDvLoading] = useState(false);
  const [dvApplied, setDvApplied] = useState(false);
  const [showDvSection, setShowDvSection] = useState(false);

  const tax = subtotal * 0;
  const delivery = subtotal > 0 ? 15 : 0;
  const total = subtotal + tax + delivery;
  const discountedTotal = dvApplied && dvData ? Math.max(0, total - dvData.dv_amount) : total;

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stripped = form.phone.replace(/\D/g, "");
    if (stripped.length !== 10) { setPhoneError("Mobile number must be exactly 10 digits"); return; }
    if (stripped[0] !== "0") { setPhoneError("Mobile number must start with 0 (e.g. 0821234567)"); return; }
    const ref = `CK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    setOrderRef(ref);
    setStep("payment");
  };

  const handleVoucherDetailsConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const stripped = form.phone.replace(/\D/g, "");
    if (stripped.length !== 10) { setPhoneError("Mobile number must be exactly 10 digits"); return; }
    if (stripped[0] !== "0") { setPhoneError("Mobile number must start with 0 (e.g. 0821234567)"); return; }
    const ref = `CK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    setOrderRef(ref);
    await handleVoucherOrder(ref);
  };

  const handleVoucherOrder = async (overrideRef?: string) => {
    if (!voucherData) return;
    if (voucherOrderInProgress.current) return;
    voucherOrderInProgress.current = true;
    setProcessing(true);

    const mealsToDeduct = totalItems;
    if (mealsToDeduct > voucherData.meals_remaining) {
      setPayError(`Your voucher only has ${voucherData.meals_remaining} meal(s) remaining, but your cart has ${mealsToDeduct} item(s).`);
      setProcessing(false);
      voucherOrderInProgress.current = false;
      return;
    }

    try {
      const ref = overrideRef ?? orderRef;
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          m_payment_id: ref,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          items: items.map((i) => ({
            id: i.product.id, name: i.product.name, quantity: i.quantity,
            price: i.product.price, unit: i.product.unit, category: i.product.category,
          })),
          subtotal, delivery_fee: delivery, total: 0,
          payment_status: "paid", payment_method: "voucher",
          event_date: form.date || null, delivery_address: form.address,
          notes: `Voucher: ${voucherData.voucher_code}. ${form.notes}`.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to place order. Please try again.");

      const newRef = result.reference ?? ref;
      const newRemaining = voucherData.meals_remaining - mealsToDeduct;
      const newStatus = newRemaining <= 0 ? "redeemed" : "active";

      await supabase.from("vouchers").update({ meals_remaining: newRemaining, status: newStatus }).eq("voucher_code", voucherData.voucher_code);
      await supabase.from("voucher_redemptions").insert({
        voucher_code: voucherData.voucher_code,
        order_id: newRef,
        meals_used: mealsToDeduct,
        customer_name: form.name || voucherData.customer_name,
        customer_email: form.email || voucherData.customer_email,
        meals_remaining_before: voucherData.meals_remaining,
        meals_remaining_after: newRemaining,
        products_ordered: items.map((i) => ({
          id: i.product.id, name: i.product.name, quantity: i.quantity,
          category: i.product.category, price: i.product.price,
        })),
        notes: `Order ${newRef} — ${mealsToDeduct} meal(s) redeemed`,
      });

      setVoucherMealsUsed(mealsToDeduct);
      setVoucherMealsRemaining(newRemaining);
      setOrderRef(newRef);
      clearCart();
      setStep("eft-success");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setProcessing(false);
      voucherOrderInProgress.current = false;
    }
  };

  const handleEFTConfirm = async () => {
    setProcessing(true);
    try {
      const orderNotes = dvApplied && dvData
        ? `Discount Voucher: ${dvData.dv_code} (R${dvData.dv_amount.toFixed(2)} credit). ${form.notes}`.trim()
        : form.notes;

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          m_payment_id: orderRef,
          customer_name: form.name, customer_email: form.email, customer_phone: form.phone,
          items: items.map((i) => ({
            id: i.product.id, name: i.product.name, quantity: i.quantity,
            price: i.product.price, unit: i.product.unit, category: i.product.category,
          })),
          subtotal, delivery_fee: delivery, total: discountedTotal,
          payment_status: "awaiting_payment", payment_method: "eft",
          event_date: form.date || null, delivery_address: form.address, notes: orderNotes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to place order. Please try again.");

      if (dvApplied && dvData) {
        await supabase
          .from("discount_vouchers")
          .update({ times_used: dvData.times_used + 1 })
          .eq("dv_code", dvData.dv_code);
      }

      setOrderRef(result.reference ?? orderRef);
      clearCart();
      setStep("eft-success");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePayFastCheckout = async () => {
    setProcessing(true);
    try {
      // Step 1: Create the order in DB with awaiting_payment status
      const orderNotes = dvApplied && dvData
        ? `Discount Voucher: ${dvData.dv_code} (R${dvData.dv_amount.toFixed(2)} credit). ${form.notes}`.trim()
        : form.notes;

      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          m_payment_id: orderRef,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          items: items.map((i) => ({
            id: i.product.id, name: i.product.name, quantity: i.quantity,
            price: i.product.price, unit: i.product.unit, category: i.product.category,
          })),
          subtotal,
          delivery_fee: delivery,
          total: discountedTotal,
          payment_status: "awaiting_payment",
          payment_method: "payfast",
          event_date: form.date || null,
          delivery_address: form.address,
          notes: orderNotes,
        }),
      });

      const createResult = await createRes.json();
      if (!createRes.ok) throw new Error(createResult.error || "Failed to create order.");

      const finalRef = createResult.reference ?? orderRef;

      // Step 2: Get signed PayFast payload from server
      const nameParts = form.name.trim().split(" ");
      const firstName = nameParts[0] || form.name;
      const lastName = nameParts.slice(1).join(" ") || "-";

      const initiateRes = await fetch("/api/payfast/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: {
            paymentId: finalRef,
            amount: discountedTotal,
            itemName: `Central Kitchen Order ${finalRef}`,
            itemDescription: items.map((i) => `${i.product.name} x${i.quantity}`).join(", "),
          },
          buyer: {
            firstName,
            lastName,
            email: form.email,
            cell: form.phone,
          },
        }),
      });

      const initiateResult = await initiateRes.json();
      if (!initiateRes.ok) throw new Error(initiateResult.error || "Failed to initiate PayFast payment.");

      // Step 3: Apply discount voucher usage if applicable
      if (dvApplied && dvData) {
        await supabase
          .from("discount_vouchers")
          .update({ times_used: dvData.times_used + 1 })
          .eq("dv_code", dvData.dv_code);
      }

      // Step 4: Build and auto-submit form to PayFast gateway
      clearCart();

      const form_el = document.createElement("form");
      form_el.method = "POST";
      form_el.action = initiateResult.gatewayUrl;

      Object.entries(initiateResult.params as Record<string, string>).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form_el.appendChild(input);
      });

      document.body.appendChild(form_el);
      form_el.submit();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to initiate PayFast payment.");
      setProcessing(false);
    }
  };

  const handleClose = () => { setIsOpen(false); setStep("cart"); };

  if (!isOpen) return null;

  return (
    <>
      <VoucherErrorModal
        isOpen={errorModal.open}
        message={errorModal.message}
        title={errorModal.title}
        onClose={closeError}
      />
      <div className="fixed inset-0 bg-[#1A1612]/40 backdrop-blur-sm z-40" onClick={handleClose} aria-hidden="true" />
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
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-[#EDE7DA] transition-colors" aria-label="Close cart">
            <Icon name="XMarkIcon" size={18} className="text-[#5C5347]" />
          </button>
        </div>

        {/* Progress Steps */}
        {step !== "confirmation" && step !== "eft-success" && (
          <div className="px-6 py-3 border-b border-[#DDD5C8] flex items-center gap-2">
            {(["cart", "details", "payment"] as CheckoutStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
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

        {/* Steps */}
        {step === "cart" && (
          <CartStepCart
            voucherCode={voucherCode}
            setVoucherCode={setVoucherCode}
            voucherData={voucherData}
            setVoucherData={setVoucherData}
            voucherError=""
            setVoucherError={setVoucherError}
            voucherLoading={voucherLoading}
            setVoucherLoading={setVoucherLoading}
            voucherApplied={voucherApplied}
            setVoucherApplied={setVoucherApplied}
            showVoucherSection={showVoucherSection}
            setShowVoucherSection={setShowVoucherSection}
            dvCode={dvCode}
            setDvCode={setDvCode}
            dvData={dvData}
            setDvData={setDvData}
            dvError=""
            setDvError={setDvError}
            dvLoading={dvLoading}
            setDvLoading={setDvLoading}
            dvApplied={dvApplied}
            setDvApplied={setDvApplied}
            showDvSection={showDvSection}
            setShowDvSection={setShowDvSection}
            onProceed={() => {
              if (voucherApplied && voucherData) {
                setForm((prev) => ({
                  ...prev,
                  name: prev.name || voucherData.customer_name || "",
                  email: prev.email || voucherData.customer_email || "",
                  phone: prev.phone || voucherData.customer_phone || "",
                }));
              }
              setStep("details");
            }}
            subtotal={subtotal}
            tax={tax}
            delivery={delivery}
            total={total}
          />
        )}

        {step === "details" && (
          <CartStepDetails
            form={form}
            setForm={setForm}
            phoneError=""
            setPhoneError={setPhoneError}
            payError=""
            voucherApplied={voucherApplied}
            voucherData={voucherData}
            processing={processing}
            totalItems={totalItems}
            onSubmit={voucherApplied ? handleVoucherDetailsConfirm : handleDetailsSubmit}
          />
        )}

        {step === "payment" && (
          <CartStepPayment
            voucherApplied={voucherApplied}
            voucherData={voucherData}
            dvApplied={dvApplied}
            dvData={dvData}
            selectedMethod={selectedMethod}
            setSelectedMethod={setSelectedMethod}
            orderRef={orderRef}
            total={total}
            discountedTotal={discountedTotal}
            totalItems={totalItems}
            payError=""
            processing={processing}
            onEFTConfirm={handleEFTConfirm}
            onVoucherOrder={() => handleVoucherOrder()}
            onPayFastCheckout={handlePayFastCheckout}
            buyerFirstName={form.name.trim().split(" ")[0] || form.name}
            buyerLastName={form.name.trim().split(" ").slice(1).join(" ") || "-"}
            buyerEmail={form.email}
            buyerCell={form.phone}
            cartItems={items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.product.price }))}
          />
        )}

        {step === "eft-success" && (
          <CartStepSuccess
            orderRef={orderRef}
            orderTotal={discountedTotal}
            form={form}
            voucherApplied={voucherApplied}
            voucherData={voucherData}
            voucherMealsUsed={voucherMealsUsed}
            voucherMealsRemaining={voucherMealsRemaining}
            onClose={handleClose}
          />
        )}

        {step === "confirmation" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="CheckIcon" size={36} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-semibold text-[#1A1612] mb-2">Booking Confirmed!</h3>
              <p className="text-[#8C8278] text-sm leading-relaxed">
                Thank you, {form.name || "valued customer"}! We&apos;ve received your order and will send a confirmation to{" "}
                <span className="text-[#C4622D] font-medium">{form.email || "your email"}</span> within 2 hours.
              </p>
            </div>
            <div className="w-full bg-[#EDE7DA] rounded-2xl p-5 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8C8278]">Event Date</span>
                <span className="font-semibold text-[#1A1612]">{form.date || "TBD"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C8278]">Payment</span>
                <span className="font-semibold text-green-600">✓ Processed</span>
              </div>
            </div>
            <button onClick={handleClose} className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all">
              Back to Menu
            </button>
          </div>
        )}
      </aside>
    </>
  );
}