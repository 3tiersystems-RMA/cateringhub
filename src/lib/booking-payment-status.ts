/** PayFast failure recorded in bookings history — no customer reference assigned. */
import type { ConfirmationEmailRecipientsMap } from "@/lib/confirmation-email-recipients";
import {
  isCustomerConfirmationDelivered,
  isDeliveryLoggingFailedError,
} from "@/lib/confirmation-email-recipients";

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
  const method = (paymentMethod || "").toLowerCase();
  // Explicit non-PayFast methods always win — never overridden by payfastPaymentId.
  // This prevents EFT/credit/voucher registrations from showing as PayFast even when
  // the payfast_payment_id column happens to be populated.
  if (method === "eft" || method === "credit" || method === "voucher") {
    return method;
  }
  // PayFast: either explicitly stored or inferred from payfastPaymentId
  if (payfastPaymentId || method === "payfast") return "payfast";
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
  payfast: "bg-[#C4622D] text-white border-[#C4622D]",
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

/** PayFast auto-confirmation email status (not manual EFT staff sends). */
export type PayfastConfirmationEmailStatus =
  | "not_applicable" |"pending" |"sent" |"failed" |"sync_pending";

export function getPayfastConfirmationEmailStatus(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
  sentAt: string | null | undefined,
  error: string | null | undefined,
  payfastPaymentId?: string | null,
  recipientsMap?: ConfirmationEmailRecipientsMap | null
): PayfastConfirmationEmailStatus {
  const method = resolveBookingPaymentMethod(paymentMethod, payfastPaymentId);
  if (method !== "payfast" || paymentStatus !== "paid") {
    return "not_applicable";
  }
  if (sentAt) return "sent";
  if (isCustomerConfirmationDelivered(recipientsMap)) return "sent";
  if (isDeliveryLoggingFailedError(error)) return "sync_pending";
  if (recipientsMap?.customer?.error) return "failed";
  if (error) return "failed";
  return "pending";
}

export function formatPayfastConfirmationEmailStatus(
  status: PayfastConfirmationEmailStatus
): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "sync_pending":
      return "Sent (sync pending)";
    case "pending":
      return "Email pending";
    case "failed":
      return "Email failed";
    default:
      return "—";
  }
}

export function getPayfastConfirmationEmailBadgeClass(
  status: PayfastConfirmationEmailStatus
): string {
  switch (status) {
    case "sent":
      return "bg-green-50 text-green-700 border-green-200";
    case "sync_pending":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "pending":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "";
  }
}

// ── EFT confirmation email status ────────────────────────────────────────────
// Mirrors the PayFast email status helpers but targets EFT paid registrations.
// The delivery data is stored in confirmation_email_recipients (JSONB) by the
// send-staff-confirmation route — the same sync pipeline PayFast uses.

export type EftConfirmationEmailStatus =
  | "not_applicable" |"pending" |"sent" |"failed" |"sync_pending";

/**
 * Derive the EFT confirmation email delivery status from DB columns.
 * Returns "not_applicable" for non-EFT or non-paid registrations.
 */
export function getEftConfirmationEmailStatus(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
  sentAt: string | null | undefined,
  error: string | null | undefined,
  payfastPaymentId?: string | null,
  recipientsMap?: ConfirmationEmailRecipientsMap | null
): EftConfirmationEmailStatus {
  const method = resolveBookingPaymentMethod(paymentMethod, payfastPaymentId);
  if (method !== "eft" || paymentStatus !== "paid") {
    return "not_applicable";
  }
  // Primary source: per-recipient JSONB (set by send-staff-confirmation)
  if (isCustomerConfirmationDelivered(recipientsMap)) return "sent";
  // Legacy fallback: payfast_confirmation_email_sent_at used as generic sent marker
  if (sentAt) return "sent";
  if (isDeliveryLoggingFailedError(error)) return "sync_pending";
  if (recipientsMap?.customer?.error) return "failed";
  if (error) return "failed";
  return "pending";
}

export function formatEftConfirmationEmailStatus(
  status: EftConfirmationEmailStatus
): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "sync_pending":
      return "Sent (sync pending)";
    case "pending":
      return "Email pending";
    case "failed":
      return "Email failed";
    default:
      return "—";
  }
}

export function getEftConfirmationEmailBadgeClass(
  status: EftConfirmationEmailStatus
): string {
  switch (status) {
    case "sent":
      return "bg-green-50 text-green-700 border-green-200";
    case "sync_pending":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "pending":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "";
  }
}
