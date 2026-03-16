"use client";

import Icon from "@/components/ui/AppIcon";
import type { VoucherData } from "./CartContext";

interface CartStepDetailsProps {
  form: { name: string; email: string; phone: string; date: string; address: string; notes: string };
  setForm: (f: { name: string; email: string; phone: string; date: string; address: string; notes: string }) => void;
  phoneError: string;
  setPhoneError: (v: string) => void;
  payError: string;
  voucherApplied: boolean;
  voucherData: VoucherData | null;
  processing: boolean;
  totalItems: number;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CartStepDetails({
  form,
  setForm,
  phoneError,
  setPhoneError,
  payError,
  voucherApplied,
  voucherData,
  processing,
  totalItems,
  onSubmit,
}: CartStepDetailsProps) {
  return (
    <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">Full Name *</label>
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
            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">Email *</label>
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
            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">Phone *</label>
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
            {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
            <p className="mt-1 text-xs text-[#B5ADA5]">Format: 0821234567</p>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">Event / Delivery Date *</label>
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
            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">Delivery Address *</label>
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
            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">Special Requests / Dietary Notes</label>
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
          disabled={voucherApplied ? (processing || totalItems > (voucherData?.meals_remaining ?? 0)) : false}
          className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {voucherApplied && processing ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Placing Order...
            </>
          ) : (
            <>
              <Icon name="LockClosedIcon" size={14} />
              {voucherApplied ? "Confirm Order" : "Continue to Payment"}
            </>
          )}
        </button>
        {voucherApplied && totalItems > (voucherData?.meals_remaining ?? 0) && (
          <p className="text-xs text-red-500 text-center mt-2 flex items-center justify-center gap-1">
            <Icon name="ExclamationCircleIcon" size={12} />
            Cart has {totalItems} items but voucher only has {voucherData?.meals_remaining} remaining.
          </p>
        )}
        {payError && voucherApplied && (
          <p className="text-xs text-red-500 text-center mt-2">{payError}</p>
        )}
      </div>
    </form>
  );
}
