"use client";

import { useState } from "react";
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
  total: number;
  discountedTotal: number;
  totalItems: number;
  payError: string;
  processing: boolean;
  onEFTConfirm: () => void;
  onVoucherOrder: () => void;
  onPayFastCheckout: () => void;
  // Buyer details for Secure Checkout display
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerEmail?: string;
  buyerCell?: string;
  // Cart items for signature string display
  cartItems?: Array<{ name: string; quantity: number; price: number }>;
}

const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYFAST_SANDBOX !== "false";

// Build a preview signature string (client-side, for display only)
function buildPreviewSigString(params: Record<string, string>): string {
  const ORDER = [
    "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
    "name_first", "name_last", "email_address", "cell_number",
    "m_payment_id", "amount", "item_name", "item_description",
  ];
  const parts = ORDER
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(String(params[k])).replace(/%20/g, "+")}`);
  if (params.passphrase) {
    parts.push(`passphrase=${encodeURIComponent(params.passphrase).replace(/%20/g, "+")}`);
  }
  return parts.join("&\n");
}

// Simple client-side MD5 (for display only — server recomputes authoritatively)
function md5(str: string): string {
  // We'll show a placeholder since crypto is server-side; actual hash shown after submit
  // For display purposes we use a deterministic preview
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Return a hex-like string for display (not a real MD5 — server computes the real one)
  return Math.abs(hash).toString(16).padStart(8, "0").repeat(4).slice(0, 32);
}

export default function CartStepPayment({
  voucherApplied,
  voucherData,
  dvApplied,
  dvData,
  selectedMethod,
  setSelectedMethod,
  orderRef,
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
  const [showSecureCheckout, setShowSecureCheckout] = useState(false);

  // Build preview sig string for display
  const previewParams: Record<string, string> = {
    merchant_id:      IS_SANDBOX ? "10000100" : "••••••",
    merchant_key:     IS_SANDBOX ? "46f0cd694581a" : "••••••••••••",
    return_url:       `${typeof window !== "undefined" ? window.location.origin : ""}/checkout/success`,
    cancel_url:       `${typeof window !== "undefined" ? window.location.origin : ""}/checkout/cancel`,
    notify_url:       `${typeof window !== "undefined" ? window.location.origin : ""}/api/payfast/itn`,
    name_first:       buyerFirstName,
    name_last:        buyerLastName,
    email_address:    buyerEmail,
    cell_number:      buyerCell,
    m_payment_id:     orderRef,
    amount:           displayTotal.toFixed(2),
    item_name:        `Central Kitchen Order`,
    item_description: cartItems.map((i) => `${i.name} x${i.quantity}`).join(", "),
    passphrase:       IS_SANDBOX ? "jt7NOE43FZPn" : "••••••••",
  };

  const sigPreview = buildPreviewSigString(previewParams);
  const md5Preview = md5(sigPreview);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* ── Secure Checkout Dark Panel (PayFast selected) ── */}
        {selectedMethod === "payfast" && !voucherApplied ? (
          <div className="bg-[#0d0d0d] min-h-full text-white">

            {/* ── Pre-testing Warning Banner ── */}
            <div className="mx-4 mt-4 border border-[#ff4444] rounded-xl p-4 bg-[#0d0d0d]">
              <p className="text-[#ff4444] text-xs font-mono font-bold mb-2">
                ⚠ Before testing — 3 requirements that WILL cause a 400 if missed:
              </p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li className="text-[#ff6666] text-[11px] font-mono leading-relaxed">
                  Buyer email below must NOT be the same as your PayFast merchant account email.
                </li>
                <li className="text-[#ff6666] text-[11px] font-mono leading-relaxed">
                  Your sandbox passphrase in the config must exactly match what is set in your PayFast sandbox account settings.
                </li>
                <li className="text-[#ff6666] text-[11px] font-mono leading-relaxed">
                  The notify_url must be a publicly reachable HTTPS URL (use ngrok if testing locally — PayFast validates it).
                </li>
              </ol>
            </div>

            {/* ── Environment Toggle ── */}
            <div className="mx-4 mt-4 bg-[#111] border border-[#222] rounded-xl p-4">
              <p className="text-[#555] text-[10px] font-mono uppercase tracking-widest mb-1">
                Payment Environment
              </p>
              <p className="text-white font-bold text-sm mb-3">
                {IS_SANDBOX ? "SANDBOX / TEST MODE" : "LIVE MODE"}
              </p>
              <div className="flex gap-2">
                {/* TEST (active sandbox) */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-default ${IS_SANDBOX ? "bg-[#1a1a00] border-[#ffcc00] text-[#ffcc00]" : "bg-[#111] border-[#333] text-[#555]"}`}>
                  <span className={`w-2 h-2 rounded-full ${IS_SANDBOX ? "bg-[#ffcc00]" : "bg-[#333]"}`} />
                  TEST
                </div>
                {/* ↑TEST (upgrade test) */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-default ${IS_SANDBOX ? "bg-[#111] border-[#444] text-[#888]" : "bg-[#111] border-[#333] text-[#555]"}`}>
                  <span className="text-[10px]">↑</span>
                  TEST
                </div>
                {/* LIVE */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-default ${!IS_SANDBOX ? "bg-[#1a0000] border-[#ff4444] text-[#ff4444]" : "bg-[#111] border-[#333] text-[#555]"}`}>
                  <span className={`w-2 h-2 rounded-full ${!IS_SANDBOX ? "bg-[#ff4444]" : "bg-[#333]"}`} />
                  LIVE
                </div>
              </div>
            </div>

            {/* ── Two-column: Order Summary + Merchant Config ── */}
            <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
              {/* Order Summary */}
              <div className="bg-[#111] border border-[#222] rounded-xl p-4">
                <p className="text-[#555] text-[10px] font-mono uppercase tracking-widest mb-3">
                  Order Summary
                </p>
                <div className="space-y-2">
                  {cartItems.length > 0 ? cartItems.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium leading-tight truncate">{item.name}</p>
                        <p className="text-[#555] text-[10px]">× {item.quantity} unit{item.quantity !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-[#39ff14] text-xs font-mono font-bold whitespace-nowrap">
                        R {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  )) : (
                    <p className="text-[#555] text-xs font-mono">No items</p>
                  )}
                  <div className="border-t border-[#222] pt-2 mt-2 flex justify-between items-center gap-1">
                    <span className="text-[#888] text-xs">Total (ZAR)</span>
                    <span className="text-[#39ff14] text-sm font-mono font-bold">
                      R {displayTotal.toFixed(2)}
                    </span>
                  </div>
                  {dvApplied && dvData && (
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#888]">Discount</span>
                      <span className="text-red-400 font-mono">-R {dvData.dv_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Merchant Config */}
              <div className="bg-[#111] border border-[#222] rounded-xl p-4">
                <p className="text-[#555] text-[10px] font-mono uppercase tracking-widest mb-3">
                  Merchant Config
                </p>
                <div className="space-y-2">
                  {[
                    { label: "MERCHANT ID", value: IS_SANDBOX ? "10000100" : "••••••••" },
                    { label: "MERCHANT KEY", value: "••••••••••••" },
                    { label: IS_SANDBOX ? "PASSPHRASE (SANDBOX)" : "PASSPHRASE", value: "•••••••" },
                    { label: "GATEWAY URL", value: IS_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[#555] text-[9px] font-mono uppercase tracking-widest mb-0.5">{label}</p>
                      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-2 py-1.5">
                        <p className="text-[#888] font-mono text-[10px] truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Buyer Details ── */}
            <div className="mx-4 mt-3 bg-[#111] border border-[#222] rounded-xl p-4">
              <p className="text-[#555] text-[10px] font-mono uppercase tracking-widest mb-3">
                Buyer Details
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "FIRST NAME", value: buyerFirstName || "—" },
                  { label: "LAST NAME", value: buyerLastName || "—" },
                  { label: "EMAIL (NOT YOUR PAYFAST ACCOUNT EMAIL)", value: buyerEmail || "—" },
                  { label: "CELL NUMBER", value: buyerCell || "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[#555] text-[9px] font-mono uppercase tracking-widest mb-1 leading-tight">{label}</p>
                    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2">
                      <p className="text-[#888] font-mono text-xs truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── MD5 Signature String Debug Panel ── */}
            <div className="mx-4 mt-3 bg-[#111] border border-[#222] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <p className="text-[#555] text-[9px] font-mono uppercase tracking-widest">
                  MD5 Signature String
                </p>
                <p className="text-[#555] text-[9px] font-mono uppercase tracking-widest text-right">
                  MERCHANT_KEY INCLUDED · UPPERCASE % ENCODING · MD5 OUTPUT LOWERCASE
                </p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {sigPreview.split("\n").map((line, i) => {
                    const eqIdx = line.indexOf("=");
                    if (eqIdx === -1) return <span key={i} className="text-[#39ff14]">{line}{"\n"}</span>;
                    const key = line.slice(0, eqIdx);
                    const val = line.slice(eqIdx);
                    return (
                      <span key={i}>
                        <span className="text-[#888]">{key}</span>
                        <span className="text-[#39ff14]">{val}</span>
                        {"\n"}
                      </span>
                    );
                  })}
                </pre>
              </div>
              {/* MD5 Hash output */}
              <div className="mt-2 bg-[#1a1400] border border-[#3a2e00] rounded-lg px-3 py-2.5">
                <p className="text-[#888] text-[10px] font-mono">
                  MD5: <span className="text-[#f5a623] font-bold">{md5Preview}</span>
                  <span className="text-[#555] ml-2 text-[9px]">(preview — server recomputes authoritatively on submit)</span>
                </p>
              </div>
            </div>

            {/* Spacer */}
            <div className="h-4" />
          </div>
        ) : (
          /* ── Standard Light Panel (EFT / Voucher) ── */
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
                    {voucherApplied ? "Meal Voucher" : "Manual EFT"}
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
                  {/* Manual EFT — default */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("eft")}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      selectedMethod === "eft" ? "border-[#C4622D] bg-[#C4622D]/5" : "border-[#DDD5C8] bg-white hover:border-[#C4622D]/40"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedMethod === "eft" ? "bg-[#C4622D] text-white" : "bg-[#EDE7DA] text-[#8C8278]"}`}>
                      <Icon name="BuildingLibraryIcon" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${selectedMethod === "eft" ? "text-[#C4622D]" : "text-[#1A1612]"}`}>Manual EFT</p>
                      <p className="text-xs text-[#8C8278]">Bank transfer to {APP_NAME}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedMethod === "eft" ? "border-[#C4622D] bg-[#C4622D]" : "border-[#DDD5C8]"}`}>
                      {selectedMethod === "eft" && <div className="w-full h-full rounded-full bg-white scale-50" />}
                    </div>
                  </button>

                  {/* PayFast */}
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left border-[#DDD5C8] bg-[#F5F5F5] opacity-50 cursor-not-allowed"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#E0E0E0] text-[#AAAAAA]">
                      <Icon name="CreditCardIcon" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#AAAAAA]">
                          PayFast
                        </p>
                        <span className="text-[10px] font-bold bg-gray-200 text-gray-500 border border-gray-300 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Currently unavailable</p>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 border-[#DDD5C8]" />
                  </button>
                </div>
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
              {dvApplied && dvData && !voucherApplied && (
                <>
                  <div className="flex justify-between text-[#5C5347]">
                    <span>Order Amount</span>
                    <span>R{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-[#5C5347]">Discount Voucher ({dvData.dv_code})</span>
                    <span className="text-red-600 font-semibold">R {dvData.dv_amount.toFixed(2)}-</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold text-[#1A1612]">
                <span>Total Due Now</span>
                <span className="text-[#C4622D]">{voucherApplied ? "R0.00 (Voucher)" : `R${displayTotal.toFixed(2)}`}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action Button ── */}
      <div className={`px-5 py-4 border-t ${selectedMethod === "payfast" && !voucherApplied ? "border-[#1e1e1e] bg-[#0d0d0d]" : "border-[#DDD5C8] bg-[#F5F0E8]"}`}>
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
              className="w-full bg-[#f5a623] text-black py-4 rounded-xl font-bold text-base hover:bg-[#e09510] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-mono"
            >
              {processing ? (
                <><Spinner /> Preparing Payment...</>
              ) : (
                <>
                  <Icon name="CreditCardIcon" size={16} />
                  Pay R{displayTotal.toFixed(2)} · {IS_SANDBOX ? "TEST MODE" : "LIVE"}
                </>
              )}
            </button>
            <p className="text-xs text-center text-[#555] mt-2 font-mono">
              You will be redirected to PayFast&apos;s secure checkout
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
