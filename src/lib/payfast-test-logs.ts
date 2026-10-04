/**
 * TEMP QA TRACING — PayFast class/event booking flow.
 * Remove this file and its imports after local PayFast + email testing is complete.
 *
 * Toggle: set PAYFAST_TEST_LOGS=0 in .env to silence without deleting code.
 */
export const PAYFAST_TEST_LOGS_ENABLED = process.env.PAYFAST_TEST_LOGS !== "0";

const TX_PREFIX = "[PAYFAST-TEST][transaction]";
const EMAIL_PREFIX = "[PAYFAST-TEST][confirmation-email]";

export type PayfastTestBookingKind = "cooking_class" | "event";

export type PayfastTestTransactionSource =
  | "payfast-itn"
  | "payment-return"
  | "record-failed-payment"
  | "complete-payfast"
  | "send-confirmation-email"
  | "reconcile-emails";

function logBlock(prefix: string, title: string, payload: Record<string, unknown>) {
  if (!PAYFAST_TEST_LOGS_ENABLED) return;
  console.log(`${prefix} ── ${title} ──`);
  console.log(JSON.stringify(payload, null, 2));
}

/** Log 1: transaction / payment finalization status and reason. */
export function logPayfastTestTransaction(input: {
  kind: PayfastTestBookingKind;
  source: PayfastTestTransactionSource;
  registrationCode?: string | null;
  registrationId?: string | null;
  payfastPaymentId?: string | null;
  payfastPaymentStatus?: string | null;
  outcome: string;
  success: boolean;
  reason?: string | null;
  extra?: Record<string, unknown>;
}) {
  logBlock(TX_PREFIX, "Transaction trail", {
    bookingType: input.kind === "cooking_class" ? "Cooking Class" : "Event",
    source: input.source,
    registrationCode: input.registrationCode ?? null,
    registrationId: input.registrationId ?? null,
    payfastPaymentId: input.payfastPaymentId ?? null,
    payfastPaymentStatus: input.payfastPaymentStatus ?? null,
    transactionDone: input.success,
    outcome: input.outcome,
    reason: input.reason ?? null,
    ...input.extra,
  });
}

/** Log 2a: who will receive the PayFast auto-confirmation email (before send). */
export function logPayfastTestEmailRecipients(input: {
  kind: PayfastTestBookingKind;
  source: PayfastTestTransactionSource;
  registrationId: string;
  registrationCode?: string | null;
  registrantName?: string | null;
  customerEmail: string;
  infoEmail?: string | null;
  adminEmail?: string | null;
  adminEmails: string[];
}) {
  logBlock(EMAIL_PREFIX, "Recipient list (before send)", {
    bookingType: input.kind === "cooking_class" ? "Cooking Class" : "Event",
    source: input.source,
    registrationId: input.registrationId,
    registrationCode: input.registrationCode ?? null,
    registrantName: input.registrantName ?? null,
    customerEmail: input.customerEmail,
    adminRecipients: {
      info_email: input.infoEmail ?? null,
      admin_email: input.adminEmail ?? null,
      allAdminCopyTo: input.adminEmails,
      adminCopyCount: input.adminEmails.length,
    },
    note:
      "Customer gets confirmation email; admin copy goes to info_email + admin_email (deduped).",
  });
}

/** Log 2b: result after attempting to send confirmation email. */
export function logPayfastTestEmailResult(input: {
  kind: PayfastTestBookingKind;
  source: PayfastTestTransactionSource;
  registrationId: string;
  registrationCode?: string | null;
  customerEmail?: string | null;
  sent: boolean;
  skipped?: boolean;
  error?: string | null;
  resendId?: string | null;
  willRetry?: boolean;
}) {
  logBlock(EMAIL_PREFIX, "Send result", {
    bookingType: input.kind === "cooking_class" ? "Cooking Class" : "Event",
    source: input.source,
    registrationId: input.registrationId,
    registrationCode: input.registrationCode ?? null,
    customerEmail: input.customerEmail ?? null,
    emailSent: input.sent,
    skipped: input.skipped ?? false,
    error: input.error ?? null,
    resendId: input.resendId ?? null,
    willRetryOnNextComplete:
      input.willRetry ?? (!input.sent && !input.skipped && Boolean(input.error)),
  });
}

/** Browser-side payment return trail (dev tools console). */
export function logPayfastTestBrowser(
  kind: PayfastTestBookingKind,
  message: string,
  payload?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_PAYFAST_TEST_LOGS === "0") return;
  const label = kind === "cooking_class" ? "Cooking Class" : "Event";
  console.log(`[PAYFAST-TEST][browser][${label}] ${message}`, payload ?? "");
}
