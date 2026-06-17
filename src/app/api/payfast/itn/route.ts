import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  validateITNSignature,
  validateWithPayFast,
  PAYFAST_IPS,
  IS_TEST,
} from "@/lib/payfast";

export async function POST(req: NextRequest) {
  const responseOk = new NextResponse("OK", { status: 200 });

  try {
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    formData.forEach((value, key) => {
      pfData[key] = String(value);
    });

    const receivedSig = pfData.signature;
    if (!receivedSig) {
      console.error("[PayFast ITN] No signature in payload");
      return responseOk;
    }
    delete pfData.signature;

    if (!validateITNSignature(pfData, receivedSig)) {
      console.error("[PayFast ITN] Signature mismatch for", pfData.m_payment_id);
      return responseOk;
    }

    const clientIp = (
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"
    )
      .split(",")[0]
      .trim();

    if (!IS_TEST && !PAYFAST_IPS.includes(clientIp)) {
      console.error("[PayFast ITN] Untrusted IP:", clientIp);
      return responseOk;
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const paymentId = pfData.m_payment_id;
    if (!paymentId) {
      console.error("[PayFast ITN] Missing m_payment_id");
      return responseOk;
    }

    const paymentStatus = pfData.payment_status;

    // ── Check if this is a pending (pre-creation) PayFast order ──────────────
    const { data: pendingRow } = await supabaseAdmin
      .from("payfast_pending_payments")
      .select("payload")
      .eq("m_payment_id", paymentId)
      .eq("payment_type", "order")
      .maybeSingle();

    if (pendingRow) {
      // Order has NOT been created yet — create it now based on payment outcome
      if (paymentStatus === "COMPLETE") {
        const p = pendingRow.payload as Record<string, unknown>;

        const receivedAmount = parseFloat(pfData.amount_gross);
        const expectedAmount = parseFloat(String(p.total));
        if (Number.isNaN(receivedAmount) || Math.abs(receivedAmount - expectedAmount) > 0.01) {
          console.error(
            `[PayFast ITN] Amount mismatch for pending order ${paymentId}. Expected: ${expectedAmount}, Got: ${receivedAmount}`
          );
          return responseOk;
        }

        const valid = await validateWithPayFast({ ...pfData });
        if (!valid) {
          console.error("[PayFast ITN] PayFast validation failed for pending order:", paymentId);
          return responseOk;
        }

        const { error: insertErr } = await supabaseAdmin.from("orders").insert({
          m_payment_id: paymentId,
          customer_name: p.customer_name,
          customer_email: p.customer_email,
          customer_phone: p.customer_phone,
          items: p.items,
          subtotal: p.subtotal,
          delivery_fee: p.delivery_fee,
          total: p.total,
          payment_status: "awaiting_confirmation",
          payment_method: "payfast",
          payfast_transaction_id: pfData.pf_payment_id || null,
          event_date: p.event_date ?? null,
          delivery_address: p.delivery_address,
          notes: `PayFast payment received. Awaiting confirmation. PF ID: ${pfData.pf_payment_id || ""}${p.notes ? ` | ${p.notes}` : ""}`,
        });

        if (insertErr) {
          console.error("[PayFast ITN] Failed to create order from pending:", insertErr.message);
          return responseOk;
        }

        // Clean up pending record
        await supabaseAdmin
          .from("payfast_pending_payments")
          .delete()
          .eq("m_payment_id", paymentId);

        console.log("[PayFast ITN] Order created from pending payment:", paymentId);
      } else if (paymentStatus === "FAILED") {
        // Just remove the pending record — no order to create
        await supabaseAdmin
          .from("payfast_pending_payments")
          .delete()
          .eq("m_payment_id", paymentId);
        console.log("[PayFast ITN] Pending order payment failed, pending record removed:", paymentId);
      }
      // PENDING status: do nothing, keep the pending record
      return responseOk;
    }

    // ── Legacy path: order already exists in DB (EFT orders or old PayFast orders) ──
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("total, payment_status")
      .eq("m_payment_id", paymentId)
      .single();

    if (orderErr || !orderRow) {
      console.error("[PayFast ITN] Order not found:", paymentId);
      return responseOk;
    }

    if (orderRow.payment_status === "paid") {
      return responseOk;
    }

    const receivedAmount = parseFloat(pfData.amount_gross);
    const expectedAmount = parseFloat(String(orderRow.total));

    if (Number.isNaN(receivedAmount) || Math.abs(receivedAmount - expectedAmount) > 0.01) {
      console.error(
        `[PayFast ITN] Amount mismatch for ${paymentId}. Expected: ${expectedAmount}, Got: ${receivedAmount}`
      );
      return responseOk;
    }

    const valid = await validateWithPayFast({ ...pfData });
    if (!valid) {
      console.error("[PayFast ITN] PayFast validation failed:", paymentId);
      return responseOk;
    }

    switch (paymentStatus) {
      case "COMPLETE":
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "awaiting_confirmation",
            payment_method: "payfast",
            payfast_transaction_id: pfData.pf_payment_id || null,
            notes: `PayFast payment received. Awaiting confirmation. PF ID: ${pfData.pf_payment_id || ""}`,
          })
          .eq("m_payment_id", paymentId);
        break;

      case "FAILED":
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("m_payment_id", paymentId);
        break;

      case "PENDING":
        break;

      default:
        break;
    }
  } catch (err) {
    console.error("[PayFast ITN] Exception:", err instanceof Error ? err.message : err);
  }

  return responseOk;
}
