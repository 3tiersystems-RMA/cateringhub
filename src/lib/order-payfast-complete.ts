import type { SupabaseClient } from "@supabase/supabase-js";

export type CompleteOrderPayfastResult =
  | { status: "created"; orderId: string; mPaymentId: string }
  | { status: "updated"; orderId: string; mPaymentId: string }
  | { status: "already_paid"; orderId: string; mPaymentId: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

export type OrderPayfastCompleteSource = "payfast-itn" | "payment-return" | "complete-payfast";

interface PendingOrderPayload {
  m_payment_id?: string;
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

function buildOrderRowFromPending(
  p: PendingOrderPayload,
  mPaymentId: string,
  payfastPaymentId?: string | null,
  source: OrderPayfastCompleteSource
) {
  const pfNote = payfastPaymentId ? `PF ID: ${payfastPaymentId}` : "";
  const baseNotes = typeof p.notes === "string" ? p.notes.trim() : "";
  const notes = [
    "PayFast payment received.",
    source === "payfast-itn" ? "Awaiting confirmation." : "Confirmed via payment return.",
    pfNote,
    baseNotes,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    m_payment_id: mPaymentId,
    customer_name: p.customer_name ?? "",
    customer_email: p.customer_email ?? "",
    customer_phone: p.customer_phone ?? "",
    items: p.items ?? [],
    subtotal: p.subtotal ?? 0,
    delivery_fee: p.delivery_fee ?? 0,
    total: p.total ?? 0,
    payment_status: "awaiting_confirmation" as const,
    payment_method: "payfast",
    payfast_transaction_id: payfastPaymentId || null,
    event_date: p.event_date ?? null,
    delivery_address: p.delivery_address ?? "",
    notes,
  };
}

/**
 * Finalize a food/catering order after PayFast payment — used by ITN webhook and
 * checkout/success fallback (same pattern as cooking class / event bookings).
 */
export async function completeOrderPayfast(
  supabaseAdmin: SupabaseClient,
  mPaymentId: string,
  source: OrderPayfastCompleteSource = "complete-payfast",
  payfastPaymentId?: string | null
): Promise<CompleteOrderPayfastResult> {
  const paymentId = mPaymentId.trim();
  if (!paymentId) {
    return { status: "not_found" };
  }

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status, m_payment_id")
    .eq("m_payment_id", paymentId)
    .maybeSingle();

  if (existing?.payment_status === "paid") {
    return {
      status: "already_paid",
      orderId: existing.id,
      mPaymentId: existing.m_payment_id || paymentId,
    };
  }

  const { data: pendingRow } = await supabaseAdmin
    .from("payfast_pending_payments")
    .select("payload")
    .eq("m_payment_id", paymentId)
    .eq("payment_type", "order")
    .maybeSingle();

  if (pendingRow) {
    const p = pendingRow.payload as PendingOrderPayload;
    const insertRow = buildOrderRowFromPending(p, paymentId, payfastPaymentId, source);

    const { data: order, error: insertErr } = await supabaseAdmin
      .from("orders")
      .insert(insertRow)
      .select("id, m_payment_id")
      .single();

    if (insertErr || !order) {
      return {
        status: "error",
        message: insertErr?.message || "Failed to create order from pending payment",
      };
    }

    await supabaseAdmin
      .from("payfast_pending_payments")
      .delete()
      .eq("m_payment_id", paymentId);

    return {
      status: "created",
      orderId: order.id,
      mPaymentId: order.m_payment_id || paymentId,
    };
  }

  if (existing) {
    const pfNote = payfastPaymentId ? `PF ID: ${payfastPaymentId}` : "";
    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "awaiting_confirmation",
        payment_method: "payfast",
        payfast_transaction_id: payfastPaymentId || null,
        notes: `PayFast payment received. Awaiting confirmation. ${pfNote}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .neq("payment_status", "paid")
      .select("id, m_payment_id");

    if (updateErr) {
      return { status: "error", message: updateErr.message };
    }

    if (!updatedRows?.length) {
      return {
        status: "already_paid",
        orderId: existing.id,
        mPaymentId: existing.m_payment_id || paymentId,
      };
    }

    return {
      status: "updated",
      orderId: existing.id,
      mPaymentId: existing.m_payment_id || paymentId,
    };
  }

  return { status: "not_found" };
}
