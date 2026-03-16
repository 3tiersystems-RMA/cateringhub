"use client";

import Icon from "@/components/ui/AppIcon";
import type { VoucherData } from "./CartContext";
import { APP_NAME } from "@/lib/constants";

const BANK_DETAILS = {
  bank: "Capitec Business",
  accountName: APP_NAME,
  accountNumber: "1051471249",
  branchCode: "450105",
};

interface CartStepSuccessProps {
  orderRef: string;
  form: { name: string; email: string; date: string };
  voucherApplied: boolean;
  voucherData: VoucherData | null;
  voucherMealsUsed: number;
  voucherMealsRemaining: number;
  onClose: () => void;
}

export default function CartStepSuccess({
  orderRef,
  form,
  voucherApplied,
  voucherData,
  voucherMealsUsed,
  voucherMealsRemaining,
  onClose,
}: CartStepSuccessProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Icon name="CheckIcon" size={36} className="text-green-600" />
        </div>
        <div>
          <h3 className="font-display text-xl font-semibold text-[#1A1612] mb-2">Order Placed Successfully!</h3>
          <p className="text-[#8C8278] text-sm leading-relaxed">
            Thank you, {form.name || "valued customer"}!{" "}
            {voucherApplied
              ? "Your order has been confirmed using your meal voucher." :"Your order has been reserved and is awaiting your EFT payment."}
          </p>
        </div>
      </div>

      <div className="bg-[#C4622D]/10 border border-[#C4622D]/30 rounded-2xl p-4 text-center">
        <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-1">Order Reference</p>
        <p className="text-xl font-mono font-bold text-[#C4622D]">{orderRef}</p>
        {voucherApplied && (
          <p className="text-xs text-[#8C8278] mt-1">Paid via voucher {voucherData?.voucher_code}</p>
        )}
      </div>

      {/* Bank Details — EFT only */}
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
            <div className="flex justify-between"><span>Voucher Code</span><span className="font-mono font-bold">{voucherData.voucher_code}</span></div>
            <div className="flex justify-between"><span>Meals Used</span><span className="font-semibold">{voucherMealsUsed > 0 ? voucherMealsUsed : "—"}</span></div>
            <div className="flex justify-between"><span>Remaining Balance</span><span className="font-semibold">{voucherMealsRemaining} meals</span></div>
          </div>
        </div>
      )}

      {/* EFT instructions */}
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
            <li>• A confirmation email will be sent to <span className="font-medium">{form.email}</span> within 2 hours.</li>
          </ul>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all"
      >
        Back to Menu
      </button>
    </div>
  );
}
