import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEventBookingConfirmationEmail } from "@/lib/event-booking-confirmation-send";
import { ensurePayfastDeliveryStatusSynced } from "@/lib/booking-payfast-confirmation-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/event-bookings/send-confirmation
 * Prefer tracked send (persists delivery status). Falls back to legacy edge invoke
 * when registrationId is missing (kept for backward compatibility).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const registrationId = String(body?.registrationId || "").trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    if (registrationId) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      let result = await sendEventBookingConfirmationEmail(
        supabaseAdmin,
        registrationId
      );

      if (result.sent && result.persisted === false) {
        const synced = await ensurePayfastDeliveryStatusSynced(
          supabaseAdmin,
          "event",
          registrationId,
          {
            sent: result.sent,
            partial: result.partial,
            resendId: result.resendId,
            persisted: result.persisted,
            persistError: result.persistError,
            recipients: result.recipients,
          }
        );
        result = { ...result, persisted: synced.persisted, persistError: synced.persistError };
      }

      if (!result.sent && !result.skipped) {
        return NextResponse.json(
          { error: result.error || "Failed to send confirmation email", ...result },
          { status: 500 }
        );
      }

      if (result.skipped) {
        return NextResponse.json({
          success: false,
          skipped: true,
          message: result.error || "Selected recipients are already notified",
          ...result,
        });
      }

      if (result.sent && result.persisted === false) {
        return NextResponse.json({
          success: true,
          warning:
            result.persistError ||
            "Email was sent but delivery status could not be saved to the database",
          ...result,
        });
      }

      return NextResponse.json({ success: true, ...result });
    }

    /* Legacy edge invoke (no DB delivery tracking) — kept for callers without registrationId:
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.functions.invoke("send-event-booking-confirmation", { body });
    ...
    */

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.functions.invoke(
      "send-event-booking-confirmation",
      { body }
    );

    if (error) {
      console.error("[send-event-booking-confirmation] Edge function error:", error);
      return NextResponse.json(
        { error: error.message || "Edge function failed" },
        { status: 500 }
      );
    }

    console.warn(
      "[send-event-booking-confirmation] Legacy untracked edge invoke used — registrationId required for DB sync"
    );
    return NextResponse.json({ success: true, untracked: true, ...(data ?? {}) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-event-booking-confirmation] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
