import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordFailedOrderResult =
  | { status: "created"; orderId: string }
  | { status: "updated"; orderId: string }
  | { status: "already_recorded"; orderId: string }
  | { status: "skipped_paid"; orderId: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

interface PendingOrderPayload {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  items?: unknown;
  subtotal?: number;
  delivery_fee?: number;
  total?: number;
  event_date?: string | null;
  delivery_address?: string;
  notes?: string;
}

/**
 * Record a failed/cancelled PayFast food order (mirrors booking failed-payment flow).
 * Creates a failed order from pending payload or updates an existing unpaid row.
 */
export async function recordFailedOrderPayment(
  supabaseAdmin: SupabaseClient,
  options: {
    mPaymentId: string;
    payfastPaymentId?: string | null;
    testSource?: "payfast-itn" | "payment-return" | "record-failed-payment";
  }
): Promise<RecordFailedOrderResult> {
  const paymentId = options.mPaymentId.trim();
  if (!paymentId) {
    return { status: "not_found" };
  }

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status")
    .eq("m_payment_id", paymentId)
    .maybeSingle();

  if (existing?.payment_status === "paid") {
    return { status: "skipped_paid", orderId: existing.id };
  }

  if (existing?.payment_status === "failed") {
    return { status: "already_recorded", orderId: existing.id };
  }

  const { data: pendingRow } = await supabaseAdmin
    .from("payfast_pending_payments")
    .select("payload")
    .eq("m_payment_id", paymentId)
    .eq("payment_type", "order")
    .maybeSingle();

  if (pendingRow) {
    const p = pendingRow.payload as PendingOrderPayload;
    const { data: order, error: insertErr } = await supabaseAdmin
      .from("orders")
      .insert({
        m_payment_id: paymentId,
        customer_name: p.customer_name ?? "",
        customer_email: p.customer_email ?? "",
        customer_phone: p.customer_phone ?? "",
        items: p.items ?? [],
        subtotal: p.subtotal ?? 0,
        delivery_fee: p.delivery_fee ?? 0,
        total: p.total ?? 0,
        payment_status: "failed",
        payment_method: "payfast",
        payfast_transaction_id: options.payfastPaymentId || null,
        event_date: p.event_date ?? null,
        delivery_address: p.delivery_address ?? "",
        notes: `PayFast payment failed or cancelled. ${typeof p.notes === "string" ? p.notes : ""}`.trim(),
      })
      .select("id")
      .single();

    if (insertErr || !order) {
      return {
        status: "error",
        message: insertErr?.message || "Failed to create failed order record",
      };
    }

    await supabaseAdmin
      .from("payfast_pending_payments")
      .delete()
      .eq("m_payment_id", paymentId);

    return { status: "created", orderId: order.id };
  }

  if (existing) {
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "failed",
        payment_method: "payfast",
        payfast_transaction_id: options.payfastPaymentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .neq("payment_status", "paid")
      .select("id");

    if (updateErr) {
      return { status: "error", message: updateErr.message };
    }

    if (!updated?.length) {
      return { status: "skipped_paid", orderId: existing.id };
    }

    return { status: "updated", orderId: existing.id };
  }

  return { status: "not_found" };
}
