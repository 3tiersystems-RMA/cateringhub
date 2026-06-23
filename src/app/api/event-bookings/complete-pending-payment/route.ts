import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeEventBookingPayfast } from "@/lib/event-booking-payfast-complete";
import { recordFailedBookingPayment } from "@/lib/booking-payfast-failed";

export const dynamic = "force-dynamic";

/**
 * POST /api/event-bookings/complete-pending-payment
 * Fallback when PayFast ITN is delayed or missed — mirrors checkout/notify-success for orders.
 * Safe to call multiple times (idempotent for already-paid bookings).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const registrationCode = String(body?.registrationCode || body?.m_payment_id || "").trim();
    const paymentStatus = String(body?.paymentStatus || body?.payment_status || "").trim();
    const payfastPaymentId = body?.payfastPaymentId || body?.pf_payment_id || null;

    if (!registrationCode) {
      return NextResponse.json({ error: "Missing registrationCode" }, { status: 400 });
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
      const failResult = await recordFailedBookingPayment(supabaseAdmin, {
        bookingType: "event",
        mPaymentId: registrationCode,
        payfastPaymentId,
      });
      if (failResult.status === "error") {
        return NextResponse.json({ error: failResult.message, registrationCode }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        outcome: failResult.status,
        registrationId:
          "registrationId" in failResult ? failResult.registrationId : undefined,
        registrationCode,
      });
    }

    if (!isComplete) {
      return NextResponse.json(
        { error: "Payment not complete", registrationCode },
        { status: 400 }
      );
    }

    // const supabaseAdmin = createClient(...) — moved above for failed path

    const result = await completeEventBookingPayfast(
      supabaseAdmin,
      registrationCode,
      payfastPaymentId
    );

    if (result.status === "not_found") {
      return NextResponse.json(
        { error: "Booking not found", registrationCode },
        { status: 404 }
      );
    }

    if (result.status === "error") {
      return NextResponse.json({ error: result.message, registrationCode }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      outcome: result.status,
      registrationId: result.registrationId,
      registrationCode: result.registrationCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[EB complete-pending-payment]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
