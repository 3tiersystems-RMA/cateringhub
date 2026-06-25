/** PayFast failure recorded in bookings history — no customer reference assigned. */
export const FAILED_PAYMENT_TRANSACTION_STATUS = "failed_payment_transaction";

export const FAILED_PAYMENT_TRANSACTION_LABEL = "Failed Payment Transactions";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  failed_payment_transaction: FAILED_PAYMENT_TRANSACTION_LABEL,
  awaiting_payment: "Awaiting Payment",
  awaiting_confirmation: "Awaiting Confirmation",
  refunded: "Refunded",
  discounted: "Discounted",
  "no-show": "No-Show",
  unpaid: "Unpaid",
};

/** All known booking registration statuses — merged with DB values for filter dropdowns. */
export const BOOKING_PAYMENT_STATUS_OPTIONS = [
  "pending",
  "paid",
  "failed",
  "failed_payment_transaction",
  "awaiting_payment",
  "awaiting_confirmation",
  "refunded",
  "discounted",
  "unpaid",
  "no-show",
] as const;

export function mergeBookingPaymentStatusOptions(dbStatuses: string[]): string[] {
  const merged = [...new Set([...BOOKING_PAYMENT_STATUS_OPTIONS, ...dbStatuses.filter(Boolean)])];
  return merged.sort((a, b) =>
    formatBookingPaymentStatus(a).localeCompare(formatBookingPaymentStatus(b))
  );
}

export function formatBookingPaymentStatus(status: string): string {
  if (PAYMENT_STATUS_LABELS[status]) {
    return PAYMENT_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isFailedPaymentTransaction(status: string | null | undefined): boolean {
  return status === FAILED_PAYMENT_TRANSACTION_STATUS || status === "failed";
}

/** Staff workspace pill filters (All / Paid / Pending / Awaiting / Failed). */
export function matchesPaymentStatusFilter(
  paymentStatus: string | null | undefined,
  filter: string
): boolean {
  if (filter === "all") return true;
  if (filter === "awaiting_payment") {
    return Boolean(paymentStatus?.includes("awaiting"));
  }
  if (filter === "failed") {
    return isFailedPaymentTransaction(paymentStatus);
  }
  return paymentStatus === filter;
}

/** Resolve booking payment method from stored fields (class/event registrations). */
export function resolveBookingPaymentMethod(
  paymentMethod: string | null | undefined,
  payfastPaymentId?: string | null
): "payfast" | "eft" | "credit" | "voucher" | string {
  if (payfastPaymentId) return "payfast";
  const method = (paymentMethod || "").toLowerCase();
  if (
    method === "payfast" ||
    method === "eft" ||
    method === "credit" ||
    method === "voucher"
  ) {
    return method;
  }
  return method || "eft";
}

export function formatBookingPaymentMethod(
  paymentMethod: string | null | undefined,
  payfastPaymentId?: string | null
): string {
  switch (resolveBookingPaymentMethod(paymentMethod, payfastPaymentId)) {
    case "payfast":
      return "PayFast";
    case "eft":
      return "EFT";
    case "credit":
      return "Credit";
    case "voucher":
      return "Meal Voucher";
    default:
      return paymentMethod
        ? paymentMethod.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "EFT";
  }
}

const PAYMENT_METHOD_BADGE_CLASSES: Record<string, string> = {
  payfast: "bg-[#FDF6EE] text-[#C4622D] border-[#E8C9B0]",
  eft: "bg-black text-white border-black",
  credit: "bg-green-50 text-green-700 border-green-200",
  voucher: "bg-amber-50 text-amber-800 border-amber-200",
};

export function getBookingPaymentMethodBadgeClass(
  paymentMethod: string | null | undefined,
  payfastPaymentId?: string | null
): string {
  const resolved = resolveBookingPaymentMethod(paymentMethod, payfastPaymentId);
  return (
    PAYMENT_METHOD_BADGE_CLASSES[resolved] ||
    "bg-gray-50 text-gray-600 border-gray-200"
  );
}
