import type { SupabaseClient } from "@supabase/supabase-js";

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
  payfastPaymentId?: string | null
): Promise<CompleteEventPendingResult> {
  const code = registrationCode.trim();
  if (!code) {
    return { status: "not_found" };
  }

  const { data: existing } = await supabaseAdmin
    .from("event_management_registrations")
    .select("id, payment_status, registration_code")
    .eq("registration_code", code)
    .maybeSingle();

  if (existing?.payment_status === "paid") {
    return {
      status: "already_paid",
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
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
      return {
        status: "error",
        message: regErr?.message || "Failed to create registration from pending payment",
      };
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

    return { status: "created", registrationId: reg.id, registrationCode: code };
  }

  if (existing) {
    const updatePayload = {
      payment_status: 'paid',
      payfast_payment_id: payfastPaymentId || code,
    };

    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("event_management_registrations")
      .update(updatePayload)
      .eq("id", existing.id)
      .neq("payment_status", "paid")
      .select("id");

    if (updateErr) {
      return { status: "error", message: updateErr.message };
    }

    if (!updatedRows?.length) {
      return {
        status: "already_paid",
        registrationId: existing.id,
        registrationCode: existing.registration_code || code,
      };
    }

    return {
      status: "updated",
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
  }

  return { status: "not_found" };
}
