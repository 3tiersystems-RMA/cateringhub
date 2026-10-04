import type { SupabaseClient } from "@supabase/supabase-js";
import { FAILED_PAYMENT_TRANSACTION_STATUS } from "./booking-payment-status";
import { logPayfastTestTransaction } from "./payfast-test-logs";

export type RecordFailedBookingResult =
  | { status: "created"; registrationId: string }
  | { status: "updated"; registrationId: string }
  | { status: "already_recorded"; registrationId: string }
  | { status: "skipped_paid"; registrationId: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

interface PendingPayload {
  registration: Record<string, unknown>;
  selectedDateIds?: string[];
}

type BookingKind = "event" | "cooking_class";

function tablesFor(kind: BookingKind) {
  if (kind === "event") {
    return {
      registrations: "event_management_registrations",
      bookingCounts: "event_management_booking_counts",
      pendingType: "event_booking",
    } as const;
  }
  return {
    registrations: "cooking_class_registrations",
    bookingCounts: "cooking_class_booking_counts",
    pendingType: "cooking_class",
  } as const;
}

function buildFailedRegistrationPayload(
  registration: Record<string, unknown>,
  payfastPaymentId?: string | null
): Record<string, unknown> {
  const payload = { ...registration };
  // Customer-facing booking reference must not be assigned for failed payments.
  payload.registration_code = null;
  payload.payment_status = FAILED_PAYMENT_TRANSACTION_STATUS;
  if (payfastPaymentId) {
    payload.payfast_payment_id = payfastPaymentId;
  }
  return payload;
}

async function insertFailedFromPending(
  supabaseAdmin: SupabaseClient,
  kind: BookingKind,
  pending: PendingPayload,
  payfastPaymentId?: string | null
): Promise<{ registrationId: string } | { error: string }> {
  const { registrations, bookingCounts } = tablesFor(kind);
  const insertPayload = buildFailedRegistrationPayload(
    pending.registration,
    payfastPaymentId
  );

  let { data: reg, error: regErr } = await supabaseAdmin
    .from(registrations)
    .insert(insertPayload)
    .select("id")
    .single();

  if ((regErr || !reg) && insertPayload.payfast_itn_data) {
    const fallback = { ...insertPayload };
    delete fallback.payfast_itn_data;
    ({ data: reg, error: regErr } = await supabaseAdmin
      .from(registrations)
      .insert(fallback)
      .select("id")
      .single());
  }

  if (regErr || !reg) {
    return {
      error: regErr?.message || "Failed to create failed payment transaction record",
    };
  }

  const dateIds = Array.isArray(pending.selectedDateIds)
    ? pending.selectedDateIds
    : [];
  if (dateIds.length > 0) {
    await supabaseAdmin.from(bookingCounts).insert(
      dateIds.map((event_date_id: string) => ({
        event_date_id,
        registration_id: reg.id,
      }))
    );
  }

  return { registrationId: reg.id };
}

/**
 * Record a failed PayFast booking in history (events + classes).
 * - Creates a row from pending payload when deferred flow was used, OR
 * - Updates an existing register-first row and clears registration_code.
 * Idempotent for rows already marked failed_payment_transaction.
 */
export async function recordFailedBookingPayment(
  supabaseAdmin: SupabaseClient,
  options: {
    bookingType: BookingKind;
    mPaymentId: string;
    payfastPaymentId?: string | null;
    testSource?: "payfast-itn" | "payment-return" | "record-failed-payment";
  }
): Promise<RecordFailedBookingResult> {
  const testSource = options.testSource ?? "record-failed-payment";
  const kind = options.bookingType === "event" ? "event" : "cooking_class";
  const code = options.mPaymentId.trim();
  if (!code) {
    logPayfastTestTransaction({
      kind,
      source: testSource,
      registrationCode: code,
      payfastPaymentId: options.payfastPaymentId ?? null,
      payfastPaymentStatus: "FAILED",
      outcome: "not_found",
      success: false,
      reason: "Empty m_payment_id",
    });
    return { status: "not_found" };
  }

  const { registrations, pendingType } = tablesFor(options.bookingType);

  const { data: existing } = await supabaseAdmin
    .from(registrations)
    .select("id, payment_status, registration_code")
    .eq("registration_code", code)
    .maybeSingle();

  if (existing) {
    if (existing.payment_status === "paid") {
      logPayfastTestTransaction({
        kind,
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: options.payfastPaymentId ?? null,
        payfastPaymentStatus: "FAILED",
        outcome: "skipped_paid",
        success: false,
        reason: "Cannot record failed transaction — registration already paid",
      });
      return { status: "skipped_paid", registrationId: existing.id };
    }
    if (
      existing.payment_status === FAILED_PAYMENT_TRANSACTION_STATUS ||
      existing.payment_status === "failed"
    ) {
      logPayfastTestTransaction({
        kind,
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: options.payfastPaymentId ?? null,
        payfastPaymentStatus: "FAILED",
        outcome: "already_recorded",
        success: true,
        reason: "Failed payment transaction already recorded",
      });
      return { status: "already_recorded", registrationId: existing.id };
    }

    const { error: updateErr } = await supabaseAdmin
      .from(registrations)
      .update({
        payment_status: FAILED_PAYMENT_TRANSACTION_STATUS,
        registration_code: null,
        ...(options.payfastPaymentId
          ? { payfast_payment_id: options.payfastPaymentId }
          : {}),
      })
      .eq("id", existing.id);

    if (updateErr) {
      logPayfastTestTransaction({
        kind,
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: options.payfastPaymentId ?? null,
        payfastPaymentStatus: "FAILED",
        outcome: "error",
        success: false,
        reason: updateErr.message,
      });
      return { status: "error", message: updateErr.message };
    }

    await supabaseAdmin
      .from("payfast_pending_payments")
      .delete()
      .eq("m_payment_id", code)
      .eq("payment_type", pendingType);

    logPayfastTestTransaction({
      kind,
      source: testSource,
      registrationCode: code,
      registrationId: existing.id,
      payfastPaymentId: options.payfastPaymentId ?? null,
      payfastPaymentStatus: "FAILED",
      outcome: "updated",
      success: true,
      reason: "Existing registration marked failed_payment_transaction",
    });
    return { status: "updated", registrationId: existing.id };
  }

  const { data: pendingRow } = await supabaseAdmin
    .from("payfast_pending_payments")
    .select("payload")
    .eq("m_payment_id", code)
    .eq("payment_type", pendingType)
    .maybeSingle();

  if (pendingRow) {
    const pending = pendingRow.payload as PendingPayload;
    const inserted = await insertFailedFromPending(
      supabaseAdmin,
      options.bookingType,
      pending,
      options.payfastPaymentId
    );

    if ("error" in inserted) {
      logPayfastTestTransaction({
        kind,
        source: testSource,
        registrationCode: code,
        payfastPaymentId: options.payfastPaymentId ?? null,
        payfastPaymentStatus: "FAILED",
        outcome: "error",
        success: false,
        reason: inserted.error,
      });
      return { status: "error", message: inserted.error };
    }

    await supabaseAdmin
      .from("payfast_pending_payments")
      .delete()
      .eq("m_payment_id", code)
      .eq("payment_type", pendingType);

    logPayfastTestTransaction({
      kind,
      source: testSource,
      registrationCode: code,
      registrationId: inserted.registrationId,
      payfastPaymentId: options.payfastPaymentId ?? null,
      payfastPaymentStatus: "FAILED",
      outcome: "created",
      success: true,
      reason: "Failed payment transaction created from pending payload",
    });
    return { status: "created", registrationId: inserted.registrationId };
  }

  logPayfastTestTransaction({
    kind,
    source: testSource,
    registrationCode: code,
    payfastPaymentId: options.payfastPaymentId ?? null,
    payfastPaymentStatus: "FAILED",
    outcome: "not_found",
    success: false,
    reason: "No pending payment or existing registration for failed record",
  });
  return { status: "not_found" };
}
