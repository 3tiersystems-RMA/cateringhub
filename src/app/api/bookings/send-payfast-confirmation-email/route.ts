import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendPayfastBookingConfirmationEmail,
  type PayfastBookingKind,
} from "@/lib/booking-payfast-confirmation-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/send-payfast-confirmation-email
 * Internal/test helper — triggers PayFast auto-confirmation send for one registration.
 * Manual EFT staff confirmation flows are unchanged.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const registrationId = String(body?.registrationId || "").trim();
    const kind = body?.kind as PayfastBookingKind;

    if (!registrationId || (kind !== "cooking_class" && kind !== "event")) {
      return NextResponse.json(
        { error: "registrationId and kind (cooking_class|event) are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const result = await sendPayfastBookingConfirmationEmail(
      supabaseAdmin,
      kind,
      registrationId
    );

    if (!result.sent && !result.skipped) {
      return NextResponse.json({ error: result.error || "Send failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
