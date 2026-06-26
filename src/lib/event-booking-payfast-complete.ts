import type { SupabaseClient } from "@supabase/supabase-js";
import { logPayfastTestTransaction } from "@/lib/payfast-test-logs";

export type CompleteEventPendingResult =
  | { status: "created"; registrationId: string; registrationCode: string }
  | { status: "updated"; registrationId: string; registrationCode: string }
  | { status: "already_paid"; registrationId: string; registrationCode: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

interface PendingPayload {
  registration: Record<string, unknown>;
  selectedDateIds: string[];
}

/**
 * Finalize an event booking after PayFast payment — used by ITN webhook and
 * payment-return fallback (same pattern as /api/checkout/notify-success for orders).
 */
export async function completeEventBookingPayfast(
  supabaseAdmin: SupabaseClient,
  registrationCode: string,
  payfastPaymentId?: string | null,
  testSource: "payfast-itn" | "payment-return" | "complete-payfast" = "complete-payfast"
): Promise<CompleteEventPendingResult> {
  const code = registrationCode.trim();
  if (!code) {
    logPayfastTestTransaction({
      kind: "event",
      source: testSource,
      registrationCode: code,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: "not_found",
      success: false,
      reason: "Empty registration code",
    });
    return { status: "not_found" };
  }

  const { data: existing } = await supabaseAdmin
    .from("event_management_registrations")
    .select("id, payment_status, registration_code")
    .eq("registration_code", code)
    .maybeSingle();

  if (existing?.payment_status === "paid") {
    const result = {
      status: "already_paid" as const,
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
    logPayfastTestTransaction({
      kind: "event",
      source: testSource,
      registrationCode: code,
      registrationId: existing.id,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: result.status,
      success: true,
      reason: "Registration already marked paid",
    });
    return result;
  }

  const { data: pendingRow } = await supabaseAdmin
    .from("payfast_pending_payments")
    .select("payload")
    .eq("m_payment_id", code)
    .eq("payment_type", "event_booking")
    .maybeSingle();

  if (pendingRow) {
    const p = pendingRow.payload as PendingPayload;

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("event_management_registrations")
      .insert({
        ...p.registration,
        payment_status: "paid",
        payfast_payment_id: payfastPaymentId || code,
      })
      .select("id")
      .single();

    if (regErr || !reg) {
      const result = {
        status: "error" as const,
        message: regErr?.message || "Failed to create registration from pending payment",
      };
      logPayfastTestTransaction({
        kind: "event",
        source: testSource,
        registrationCode: code,
        payfastPaymentId: payfastPaymentId ?? null,
        outcome: result.status,
        success: false,
        reason: result.message,
      });
      return result;
    }

    if (Array.isArray(p.selectedDateIds) && p.selectedDateIds.length > 0) {
      await supabaseAdmin.from("event_management_booking_counts").insert(
        p.selectedDateIds.map((event_date_id: string) => ({
          event_date_id,
          registration_id: reg.id,
        }))
      );
    }

    await supabaseAdmin
      .from("payfast_pending_payments")
      .delete()
      .eq("m_payment_id", code);

    const result = { status: "created" as const, registrationId: reg.id, registrationCode: code };
    logPayfastTestTransaction({
      kind: "event",
      source: testSource,
      registrationCode: code,
      registrationId: reg.id,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: result.status,
      success: true,
      reason: "Created registration from pending PayFast payment",
    });
    return result;
  }

  if (existing) {
    const updatePayload = {
      payment_status: "paid",
      payfast_payment_id: payfastPaymentId || code,
    };

    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("event_management_registrations")
      .update(updatePayload)
      .eq("id", existing.id)
      .neq("payment_status", "paid")
      .select("id");

    if (updateErr) {
      const result = { status: "error" as const, message: updateErr.message };
      logPayfastTestTransaction({
        kind: "event",
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: payfastPaymentId ?? null,
        outcome: result.status,
        success: false,
        reason: result.message,
      });
      return result;
    }

    if (!updatedRows?.length) {
      const result = {
        status: "already_paid" as const,
        registrationId: existing.id,
        registrationCode: existing.registration_code || code,
      };
      logPayfastTestTransaction({
        kind: "event",
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: payfastPaymentId ?? null,
        outcome: result.status,
        success: true,
        reason: "Update matched no rows — already paid",
      });
      return result;
    }

    const result = {
      status: "updated" as const,
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
    logPayfastTestTransaction({
      kind: "event",
      source: testSource,
      registrationCode: code,
      registrationId: existing.id,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: result.status,
      success: true,
      reason: "Existing registration marked paid",
    });
    return result;
  }

  logPayfastTestTransaction({
    kind: "event",
    source: testSource,
    registrationCode: code,
    payfastPaymentId: payfastPaymentId ?? null,
    outcome: "not_found",
    success: false,
    reason: "No pending payment or existing registration for code",
  });
  return { status: "not_found" };
}
