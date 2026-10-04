import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeOrderPayfast } from "@/lib/order-payfast-complete";
import { recordFailedOrderPayment } from "@/lib/order-payfast-failed";
import { maybeSendPayfastOrderConfirmationEmail } from "@/lib/order-confirmation-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/complete-pending-payment
 * Fallback when PayFast ITN is delayed or missed — mirrors cooking-classes / event-bookings.
 * Safe to call multiple times (idempotent for already-paid orders).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mPaymentId = String(
      body?.mPaymentId || body?.m_payment_id || body?.orderRef || ""
    ).trim();
    const paymentStatus = String(body?.paymentStatus || body?.payment_status || "").trim();
    const payfastPaymentId = body?.payfastPaymentId || body?.pf_payment_id || null;

    if (!mPaymentId) {
      return NextResponse.json({ error: "Missing mPaymentId" }, { status: 400 });
    }

    const isComplete =
      !paymentStatus ||
      paymentStatus === "COMPLETE" ||
      paymentStatus === "Complete";

    const isFailed =
      paymentStatus === "FAILED" ||
      paymentStatus === "Failed" ||
      paymentStatus === "CANCELLED";

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    if (isFailed) {
      const failResult = await recordFailedOrderPayment(supabaseAdmin, {
        mPaymentId,
        payfastPaymentId,
        testSource: "payment-return",
      });
      if (failResult.status === "error") {
        return NextResponse.json({ error: failResult.message, mPaymentId }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        outcome: failResult.status,
        orderId: "orderId" in failResult ? failResult.orderId : undefined,
        mPaymentId,
      });
    }

    if (!isComplete) {
      return NextResponse.json(
        { error: "Payment not complete", mPaymentId },
        { status: 400 }
      );
    }

    const result = await completeOrderPayfast(
      supabaseAdmin,
      mPaymentId,
      "payment-return",
      payfastPaymentId
    );

    if (result.status === "not_found") {
      // ITN may have finalized the order already (pending row removed)
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id, m_payment_id, payment_status")
        .eq("m_payment_id", mPaymentId)
        .maybeSingle();

      if (existing) {
        const recovered =
          existing.payment_status === "paid"
            ? ({
                status: "already_paid" as const,
                orderId: existing.id,
                mPaymentId: existing.m_payment_id || mPaymentId,
              })
            : ({
                status: "updated" as const,
                orderId: existing.id,
                mPaymentId: existing.m_payment_id || mPaymentId,
              });

        const emailResult = await maybeSendPayfastOrderConfirmationEmail(
          supabaseAdmin,
          recovered,
          "payment-return"
        );

        return NextResponse.json({
          success: true,
          outcome: recovered.status,
          orderId: existing.id,
          mPaymentId: existing.m_payment_id || mPaymentId,
          emailSent: emailResult.sent,
          emailSkipped: emailResult.skipped ?? false,
          emailError: emailResult.error ?? null,
        });
      }

      return NextResponse.json(
        { error: "Order not found", mPaymentId },
        { status: 404 }
      );
    }

    if (result.status === "error") {
      return NextResponse.json({ error: result.message, mPaymentId }, { status: 500 });
    }

    const emailResult = await maybeSendPayfastOrderConfirmationEmail(
      supabaseAdmin,
      result,
      "payment-return"
    );

    return NextResponse.json({
      success: true,
      outcome: result.status,
      orderId: "orderId" in result ? result.orderId : undefined,
      mPaymentId: "mPaymentId" in result ? result.mPaymentId : mPaymentId,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped ?? false,
      emailError: emailResult.error ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[orders complete-pending-payment]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
