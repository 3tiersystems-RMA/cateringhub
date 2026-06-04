"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/AppIcon";
import type { VoucherData, DiscountVoucherData } from "./CartContext";
import { APP_NAME } from "@/lib/constants";

const BANK_DETAILS = {
  bank: "Capitec Business",
  accountName: APP_NAME,
  accountNumber: "1051471249",
  branchCode: "450105",
};

type PaymentMethod = "eft" | "voucher" | "payfast";

interface CartStepPaymentProps {
  voucherApplied: boolean;
  voucherData: VoucherData | null;
  dvApplied: boolean;
  dvData: DiscountVoucherData | null;
  selectedMethod: PaymentMethod;
  setSelectedMethod: (m: PaymentMethod) => void;
  orderRef: string;
  subtotal: number;
  delivery: number;
  total: number;
  discountedTotal: number;
  totalItems: number;
  payError: string;
  processing: boolean;
  onEFTConfirm: () => void;
  onVoucherOrder: () => void;
  onPayFastCheckout: () => void;
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerEmail?: string;
  buyerCell?: string;
  cartItems?: Array<{ name: string; quantity: number; price: number }>;
}

export default function CartStepPayment({
  voucherApplied,
  voucherData,
  dvApplied,
  dvData,
  selectedMethod,
  setSelectedMethod,
  orderRef,
  subtotal,
  delivery,
  total,
  discountedTotal,
  totalItems,
  payError,
  processing,
  onEFTConfirm,
  onVoucherOrder,
  onPayFastCheckout,
  buyerFirstName = "",
  buyerLastName = "",
  buyerEmail = "",
  buyerCell = "",
  cartItems = [],
}: CartStepPaymentProps) {
  const displayTotal = voucherApplied ? 0 : discountedTotal;
  const buyerName = [buyerFirstName, buyerLastName].filter(Boolean).join(" ").trim() || "—";
  const [payfastIsSandbox, setPayfastIsSandbox] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payfast/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.isSandbox === "boolean") {
          setPayfastIsSandbox(data.isSandbox);
        }
      })
      .catch(() => {
        if (!cancelled) setPayfastIsSandbox(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        <div className="px-6 py-5 space-y-5">
            {/* Payment summary card */}
            <div className="bg-gradient-to-br from-[#1A1612] to-[#3D342D] rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C4622D]/20 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#D4A853]/10 rounded-full translate-y-8 -translate-x-8" />
              <div className="relative z-10">
                <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">
                  {voucherApplied ? "Voucher Payment" : "Total Due Now"}
                </p>
                <p className="text-2xl font-display font-semibold mb-1">
                  {voucherApplied ? "R0.00" : `R${displayTotal.toFixed(2)}`}
                </p>
                {voucherApplied && (
                  <p className="text-xs text-green-400 font-mono">Paid via voucher {voucherData?.voucher_code}</p>
                )}
                {dvApplied && dvData && !voucherApplied && (
                  <p className="text-xs text-red-400 font-mono">Discount applied: R {dvData.dv_amount.toFixed(2)}-</p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Icon name="ShieldCheckIcon" size={18} className="text-[#D4A853]" />
                  <p className="text-sm text-white/60 font-mono tracking-widest">
                    {voucherApplied
                      ? "Meal Voucher"
                      : selectedMethod === "payfast" ?"PayFast Secure Checkout"
                      : selectedMethod === "eft" ?"Manual EFT" :"Choose Payment Method"}
                  </p>
                </div>
              </div>
            </div>

            {/* Voucher details or payment method selection */}
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
              <div>
                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">Select Payment Method</p>
                <div className="space-y-2">
                  {/* Manual EFT — inactive until further notice */}
                  <div
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-[#DDD5C8] bg-[#F5F3F0] opacity-60 cursor-not-allowed text-left relative"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#EDE7DA] text-[#B5ADA5]">
                      <Icon name="BuildingLibraryIcon" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#B5ADA5]">Manual EFT</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#DDD5C8] text-[#8C8278] px-2 py-0.5 rounded-full">Unavailable</span>
                      </div>
                      <p className="text-xs text-[#C4B8AC]">Bank transfer to {APP_NAME}</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 border-[#DDD5C8]" />
                  </div>

                  {/* PayFast */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("payfast")}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      selectedMethod === "payfast" ? "border-[#C4622D] bg-[#C4622D]/5" : "border-[#DDD5C8] bg-white hover:border-[#C4622D]/40"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedMethod === "payfast" ? "bg-[#C4622D] text-white" : "bg-[#EDE7DA] text-[#8C8278]"}`}>
                      <Icon name="CreditCardIcon" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${selectedMethod === "payfast" ? "text-[#C4622D]" : "text-[#1A1612]"}`}>PayFast</p>
                      <p className="text-xs text-[#8C8278]">Card, instant EFT &amp; more via payfast.co.za</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedMethod === "payfast" ? "border-[#C4622D] bg-[#C4622D]" : "border-[#DDD5C8]"}`}>
                      {selectedMethod === "payfast" && <div className="w-full h-full rounded-full bg-white scale-50" />}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* PayFast checkout summary */}
            {selectedMethod === "payfast" && !voucherApplied && (
              <div className="bg-white border border-[#DDD5C8] rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Icon name="CreditCardIcon" size={15} className="text-[#C4622D]" />
                  <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider">PayFast Checkout</p>
                </div>
                <p className="text-xs text-[#8C8278] leading-relaxed">
                  Your order will be saved, then you&apos;ll be redirected to PayFast&apos;s secure payment page to complete payment by card or instant EFT.
                </p>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                  The email above must <strong>not</strong> be the same as your PayFast merchant login email. PayFast will reject the payment if they match — use a different customer email when testing.
                </p>
                {payfastIsSandbox === true && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    PayFast <strong>sandbox</strong> is active — use a sandbox test card or instant EFT. Buyer email must differ from your merchant login.
                  </p>
                )}
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Order Reference", value: orderRef || "—" },
                    { label: "Name", value: buyerName },
                    { label: "Email", value: buyerEmail || "—" },
                    { label: "Phone", value: buyerCell || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-[#F0EBE3] last:border-0 gap-3">
                      <span className="text-[#8C8278] text-xs flex-shrink-0">{label}</span>
                      <span className="font-semibold text-[#1A1612] text-xs text-right truncate">{value}</span>
                    </div>
                  ))}
                </div>
                {cartItems.length > 0 && (
                  <div className="border-t border-[#F0EBE3] pt-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#8C8278] uppercase tracking-wider">Items</p>
                    {cartItems.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-[#5C5347] truncate pr-2">{item.name} × {item.quantity}</span>
                        <span className="font-mono font-semibold text-[#1A1612] whitespace-nowrap">R {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bank Details — EFT only */}
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
              {!voucherApplied && (
                <>
                  <div className="flex justify-between text-[#5C5347]">
                    <span>Subtotal</span>
                    <span>R{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#5C5347]">
                    <span>Delivery</span>
                    <span>R{delivery.toFixed(2)}</span>
                  </div>
                </>
              )}
              {dvApplied && dvData && !voucherApplied && (
                <div className="flex justify-between font-medium">
                  <span className="text-[#5C5347]">Discount Voucher ({dvData.dv_code})</span>
                  <span className="text-red-600 font-semibold">R {dvData.dv_amount.toFixed(2)}-</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-[#1A1612] pt-1.5 border-t border-[#DDD5C8]">
                <span>Total Due Now</span>
                <span className="text-[#C4622D]">{voucherApplied ? "R0.00 (Voucher)" : `R${displayTotal.toFixed(2)}`}</span>
              </div>
            </div>
          </div>
      </div>

      {/* ── Action Button ── */}
      <div className="px-5 py-4 border-t border-[#DDD5C8] bg-[#F5F0E8]">
        {voucherApplied ? (
          <>
            <button
              type="button"
              onClick={onVoucherOrder}
              disabled={processing || totalItems > (voucherData?.meals_remaining ?? 0)}
              className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? <><Spinner /> Placing Order...</> : <><Icon name="TicketIcon" size={14} /> Confirm Voucher Order</>}
            </button>
            <p className="text-xs text-center text-[#B5ADA5] mt-3">{totalItems} meal(s) will be deducted from your voucher balance</p>
          </>
        ) : selectedMethod === "payfast" ? (
          <>
            <button
              type="button"
              onClick={onPayFastCheckout}
              disabled={processing}
              className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <><Spinner /> Redirecting to PayFast...</>
              ) : (
                <>
                  <Icon name="CreditCardIcon" size={14} />
                  Pay R{displayTotal.toFixed(2)} with PayFast
                </>
              )}
            </button>
            <p className="text-xs text-center text-[#B5ADA5] mt-3">
              You will be redirected to PayFast to complete your payment securely
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEFTConfirm}
              disabled={processing}
              className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? <><Spinner /> Placing Order...</> : <><Icon name="BuildingLibraryIcon" size={14} /> Confirm EFT Order</>}
            </button>
            <p className="text-xs text-center text-[#B5ADA5] mt-3">Your order will be reserved while we await your EFT payment</p>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}
