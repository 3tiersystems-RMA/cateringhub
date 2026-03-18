"use client";

import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { useCart } from "./CartContext";
import type { VoucherData } from "./CartContext";

import { createClient } from "@/lib/supabase/client";

interface CartStepCartProps {
  voucherCode: string;
  setVoucherCode: (v: string) => void;
  voucherData: VoucherData | null;
  setVoucherData: (v: VoucherData | null) => void;
  voucherError: string;
  setVoucherError: (v: string) => void;
  voucherLoading: boolean;
  setVoucherLoading: (v: boolean) => void;
  voucherApplied: boolean;
  setVoucherApplied: (v: boolean) => void;
  showVoucherSection: boolean;
  setShowVoucherSection: (v: boolean) => void;
  onProceed: () => void;
  subtotal: number;
  tax: number;
  delivery: number;
  total: number;
}

export default function CartStepCart({
  voucherCode,
  setVoucherCode,
  voucherData,
  setVoucherData,
  voucherError,
  setVoucherError,
  voucherLoading,
  setVoucherLoading,
  voucherApplied,
  setVoucherApplied,
  showVoucherSection,
  setShowVoucherSection,
  onProceed,
  subtotal,
  tax,
  delivery,
  total,
}: CartStepCartProps) {
  const { items, removeItem, updateQty, totalItems, setIsOpen, setAppliedVoucher } = useCart();
  const supabase = createClient();

  const handleValidateVoucher = async () => {
    setVoucherError("");
    const code = voucherCode.trim().toUpperCase();
    if (!code) { setVoucherError("Please enter a voucher code."); return; }
    setVoucherLoading(true);
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("voucher_code, customer_name, customer_email, customer_phone, total_meals, meals_remaining, status, package_type")
        .eq("voucher_code", code)
        .single();

      if (error || !data) { setVoucherError("Voucher code not found. Please check and try again."); return; }
      if (data.status === "unpaid") {
        setVoucherError("This voucher has not been paid for yet. Please complete your payment at the Meal Vouchers page before placing an order.");
        return;
      }
      if (data.status !== "active" && data.status !== "paid") {
        setVoucherError(`This voucher is ${data.status}. It cannot be used.`);
        return;
      }
      if (data.meals_remaining <= 0) { setVoucherError("This voucher has no meals remaining."); return; }

      const vPkg = data.package_type || "none";
      const mismatchedItems = items.filter((i) => {
        const iPkg = i.product.packageType || "none";
        if (iPkg === "none") return false;
        return iPkg !== vPkg;
      });
      if (mismatchedItems.length > 0) {
        const labels: Record<string, string> = {
          "package-6": "6-Meal Package",
          "package-10": "10-Meal Package",
          "package-12": "12-Meal Package",
          "package-24": "24-Meal Package",
        };
        setVoucherError(`Your cart contains items from a different package tier. This voucher is for the ${labels[vPkg] || vPkg}. Please remove mismatched items first.`);
        return;
      }

      setVoucherData(data as VoucherData);
      setVoucherApplied(true);
      setAppliedVoucher(data as VoucherData);
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
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EDE7DA] flex items-center justify-center">
              <Icon name="ShoppingCartIcon" size={28} className="text-[#B5ADA5]" />
            </div>
            <p className="text-[#8C8278] text-sm">Your cart is empty.</p>
            <button onClick={() => setIsOpen(false)} className="text-xs font-semibold text-[#C4622D] hover:underline">
              Browse the menu &rarr;
            </button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.product.id} className="flex gap-3 bg-white rounded-2xl p-3 border border-[#DDD5C8]">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#EDE7DA]">
                <AppImage src={item.product.image} alt={item.product.imageAlt} width={64} height={64} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1612] line-clamp-1">{item.product.name}</p>
                <p className="text-xs text-[#8C8278] font-mono">{item.product.unit}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 bg-[#EDE7DA] rounded-full px-2 py-1">
                    <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-[#C4622D] hover:text-white transition-colors" aria-label="Decrease quantity">
                      <Icon name="MinusIcon" size={10} />
                    </button>
                    <span className="text-xs font-semibold text-[#1A1612] w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-[#C4622D] hover:text-white transition-colors" aria-label="Increase quantity">
                      <Icon name="PlusIcon" size={10} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#1A1612]">R{(item.product.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeItem(item.product.id)} className="p-1 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors text-[#B5ADA5]" aria-label="Remove item">
                      <Icon name="TrashIcon" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Voucher Section */}
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
                        onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(""); }}
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
                        <p className="text-xs text-green-600 mt-0.5">{voucherData?.meals_remaining} meal(s) remaining · {voucherData?.customer_name}</p>
                      </div>
                      <button onClick={handleRemoveVoucher} className="text-green-500 hover:text-red-500 transition-colors flex-shrink-0" aria-label="Remove voucher">
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

      {/* Order Summary Footer */}
      {items.length > 0 && (
        <div className="px-6 py-5 border-t border-[#DDD5C8] space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[#5C5347]"><span>Subtotal</span><span>R{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-[#5C5347]"><span>Delivery</span><span>R{delivery.toFixed(2)}</span></div>
            <div className="flex justify-between text-[#5C5347]"><span>Tax (15%)</span><span>R{tax.toFixed(2)}</span></div>
            {voucherApplied && (
              <div className="flex justify-between text-green-600 font-medium"><span>Voucher Payment</span><span>✓ Applied</span></div>
            )}
            <div className="flex justify-between font-semibold text-[#1A1612] text-base pt-2 border-t border-[#DDD5C8]">
              <span>Total</span>
              <span>{voucherApplied ? <span className="text-green-600">R0.00 (Voucher)</span> : `R${total.toFixed(2)}`}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setIsOpen(false)} className="w-full border border-[#C4622D] text-[#C4622D] py-3.5 rounded-full font-semibold text-sm hover:bg-[#F5EDE6] transition-all flex items-center justify-center gap-2">
              Continue Shopping
            </button>
            <button onClick={onProceed} className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra hover:shadow-terra-lg flex items-center justify-center gap-2">
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
  );
}
