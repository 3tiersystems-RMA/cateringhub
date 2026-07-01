import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordFailedBookingPayment } from "@/lib/booking-payfast-failed";
import { recordFailedOrderPayment } from "@/lib/order-payfast-failed";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/record-failed-payment
 * Records a failed/cancelled PayFast booking in history (events + classes + food orders).
 * Safe to call multiple times (idempotent).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mPaymentId = String(
      body?.mPaymentId || body?.m_payment_id || body?.registrationCode || ""
    ).trim();
    const bookingTypeRaw = body?.bookingType;
    const bookingType =
      bookingTypeRaw === "event"
        ? "event"
        : bookingTypeRaw === "order"
          ? "order"
          : "cooking_class";
    const payfastPaymentId =
      body?.payfastPaymentId || body?.pf_payment_id || null;

    if (!mPaymentId) {
      return NextResponse.json({ error: "Missing mPaymentId" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    if (bookingType === "order") {
      const result = await recordFailedOrderPayment(supabaseAdmin, {
        mPaymentId,
        payfastPaymentId,
        testSource: "record-failed-payment",
      });

      if (result.status === "error") {
        return NextResponse.json({ error: result.message, mPaymentId }, { status: 500 });
      }

      if (result.status === "not_found") {
        return NextResponse.json(
          { success: false, outcome: "not_found", mPaymentId },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        outcome: result.status,
        orderId: "orderId" in result ? result.orderId : undefined,
        mPaymentId,
      });
    }

    const result = await recordFailedBookingPayment(supabaseAdmin, {
      bookingType,
      mPaymentId,
      payfastPaymentId,
      testSource: "record-failed-payment",
    });

    if (result.status === "error") {
      return NextResponse.json({ error: result.message, mPaymentId }, { status: 500 });
    }

    if (result.status === "not_found") {
      return NextResponse.json(
        { success: false, outcome: "not_found", mPaymentId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      outcome: result.status,
      registrationId:
        "registrationId" in result ? result.registrationId : undefined,
      mPaymentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[record-failed-payment]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
