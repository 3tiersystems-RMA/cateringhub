import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompleteOrderPayfastResult } from "@/lib/order-payfast-complete";
import {
  buildAdminEmailsList,
  invokeSendEftOrderReceivedEdgeFunction,
  invokeSendPaymentConfirmationEdgeFunction,
} from "@/lib/invoke-send-payment-confirmation";

export type OrderPayfastEmailSource = "payfast-itn" | "payment-return" | "send-confirmation-email";

export interface OrderConfirmationEmailResult {
  sent: boolean;
  skipped?: boolean;
  resendId?: string;
  error?: string;
}

function isPfEmailColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("payfast_confirmation_email_sent_at") ||
    m.includes("payfast_confirmation_email_error") ||
    m.includes("payfast_confirmation_email_resend_id")
  );
}

function isEftEmailColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("eft_received_email_sent_at") || m.includes("eft_received_email_error");
}

async function loadCorrespondenceSettings(supabaseAdmin: SupabaseClient) {
  const { data } = await supabaseAdmin
    .from("correspondence_settings")
    .select("info_email, admin_email, form_header_title, logo_url, banking_details")
    .limit(1)
    .maybeSingle();
  return data;
}

function formatPaymentMethodLabel(method: string | null | undefined): string {
  switch ((method || "").toLowerCase()) {
    case "payfast":
      return "PayFast";
    case "eft":
      return "EFT";
    case "voucher":
      return "Meal Voucher";
    default:
      return method?.trim() || "EFT";
  }
}

/**
 * Sends payment confirmation to customer (+ admin copy) after PayFast payment.
 * Marks order as paid and records payfast_confirmation_email_sent_at (idempotent).
 */
export async function sendPayfastOrderConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  orderId: string,
  source: OrderPayfastEmailSource = "send-confirmation-email"
): Promise<OrderConfirmationEmailResult> {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select(
      "id, m_payment_id, customer_name, customer_email, customer_phone, items, subtotal, delivery_fee, total, payment_status, payment_method, event_date, delivery_address, notes, created_at, payfast_confirmation_email_sent_at"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr && !isPfEmailColumnError(orderErr.message)) {
    return { sent: false, error: orderErr.message };
  }

  if (!order) {
    return { sent: false, error: "Order not found" };
  }

  const paymentMethod = (order.payment_method || "").toLowerCase();
  if (paymentMethod === "eft") {
    // EFT confirmations are sent manually from Payment Confirmation — do not auto-duplicate.
    return { sent: false, skipped: true };
  }

  if (order.payfast_confirmation_email_sent_at) {
    return { sent: false, skipped: true };
  }

  if (!order.customer_email?.trim()) {
    return { sent: false, error: "Order has no customer email" };
  }

  const corr = await loadCorrespondenceSettings(supabaseAdmin);
  const adminEmails = buildAdminEmailsList(corr?.info_email, corr?.admin_email);

  const invokeResult = await invokeSendPaymentConfirmationEdgeFunction({
    orderId: order.m_payment_id || order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    orderTotal: order.total,
    eventDate: order.event_date,
    deliveryAddress: order.delivery_address,
    notes: order.notes,
    paymentMethod: formatPaymentMethodLabel(order.payment_method || "payfast"),
    createdAt: order.created_at,
    formHeaderTitle: corr?.form_header_title || "Cardamom Kitchen",
    logoUrl: corr?.logo_url || null,
    adminEmails,
  });

  if (!invokeResult.ok) {
    const errMsg = invokeResult.error || "Failed to send confirmation email";
    try {
      await supabaseAdmin
        .from("orders")
        .update({ payfast_confirmation_email_error: errMsg })
        .eq("id", orderId);
    } catch {
      // Column may not exist until migration applied
    }
    console.error(`[order-confirmation-email] PayFast send failed (${source}):`, errMsg);
    return { sent: false, error: errMsg };
  }

  const sentAt = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    payfast_confirmation_email_error: null,
    updated_at: sentAt,
    payfast_confirmation_email_sent_at: sentAt,
  };

  if (invokeResult.emailId) {
    updatePayload.payfast_confirmation_email_resend_id = invokeResult.emailId;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateErr && !isPfEmailColumnError(updateErr.message)) {
    console.error(
      `[order-confirmation-email] Email sent but DB update failed (${source}):`,
      updateErr.message
    );
  }

  return { sent: true, resendId: invokeResult.emailId };
}

/**
 * Call after completeOrderPayfast succeeds (ITN or payment-return).
 * Retries when order is already_paid but confirmation email was never sent.
 */
export async function maybeSendPayfastOrderConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  outcome: CompleteOrderPayfastResult,
  source: OrderPayfastEmailSource = "send-confirmation-email"
): Promise<OrderConfirmationEmailResult> {
  if (outcome.status === "not_found" || outcome.status === "error") {
    return { sent: false, error: outcome.status === "error" ? outcome.message : "Order not found" };
  }

  if (!("orderId" in outcome)) {
    return { sent: false, error: "Missing order id" };
  }

  if (outcome.status === "already_paid") {
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select("payfast_confirmation_email_sent_at, payment_method")
      .eq("id", outcome.orderId)
      .maybeSingle();

    if (row?.payfast_confirmation_email_sent_at) {
      return { sent: false, skipped: true };
    }

    if ((row?.payment_method || "").toLowerCase() === "eft") {
      return { sent: false, skipped: true };
    }
  }

  try {
    return await sendPayfastOrderConfirmationEmail(supabaseAdmin, outcome.orderId, source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[order-confirmation-email] Unexpected error (${source}):`, message);
    return { sent: false, error: message };
  }
}

/**
 * Sends "order received — please pay via EFT" email when an EFT order is placed.
 */
export async function sendEftOrderReceivedEmail(
  supabaseAdmin: SupabaseClient,
  orderId: string
): Promise<OrderConfirmationEmailResult> {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select(
      "id, m_payment_id, customer_name, customer_email, customer_phone, items, subtotal, delivery_fee, total, event_date, delivery_address, notes, created_at, eft_received_email_sent_at, payment_method"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr && !isEftEmailColumnError(orderErr.message)) {
    return { sent: false, error: orderErr.message };
  }

  if (!order) {
    return { sent: false, error: "Order not found" };
  }

  if ((order.payment_method || "").toLowerCase() !== "eft") {
    return { sent: false, skipped: true };
  }

  if (order.eft_received_email_sent_at) {
    return { sent: false, skipped: true };
  }

  if (!order.customer_email?.trim()) {
    return { sent: false, error: "Order has no customer email" };
  }

  const corr = await loadCorrespondenceSettings(supabaseAdmin);

  const invokeResult = await invokeSendEftOrderReceivedEdgeFunction({
    orderRef: order.m_payment_id || order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    orderTotal: order.total,
    eventDate: order.event_date,
    deliveryAddress: order.delivery_address,
    notes: order.notes,
    createdAt: order.created_at,
    formHeaderTitle: corr?.form_header_title || "Cardamom Kitchen",
    logoUrl: corr?.logo_url || null,
    bankingDetails: corr?.banking_details || null,
  });

  if (!invokeResult.ok) {
    const errMsg = invokeResult.error || "Failed to send EFT order received email";
    try {
      await supabaseAdmin
        .from("orders")
        .update({ eft_received_email_error: errMsg })
        .eq("id", orderId);
    } catch {
      // Column may not exist until migration applied
    }
    return { sent: false, error: errMsg };
  }

  const sentAt = new Date().toISOString();
  await supabaseAdmin
    .from("orders")
    .update({
      eft_received_email_sent_at: sentAt,
      eft_received_email_error: null,
      updated_at: sentAt,
    })
    .eq("id", orderId);

  return { sent: true, resendId: invokeResult.emailId };
}
