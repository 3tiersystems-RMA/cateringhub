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
