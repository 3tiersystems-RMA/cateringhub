import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCookingClassConfirmationEmail } from "@/lib/cooking-class-confirmation-send";
import {
  ensurePayfastDeliveryStatusSynced,
} from "@/lib/booking-payfast-confirmation-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/cooking-classes/send-confirmation
 * Prefer tracked send (persists delivery status). Falls back to legacy edge proxy
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

    // Tracked path — syncs DB with actual Resend delivery (recommended).
    if (registrationId) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      let result = await sendCookingClassConfirmationEmail(
        supabaseAdmin,
        registrationId
      );

      if (result.sent && result.persisted === false) {
        const synced = await ensurePayfastDeliveryStatusSynced(
          supabaseAdmin,
          "cooking_class",
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

    /* Legacy edge-proxy path (no DB delivery tracking) — kept for callers without registrationId:
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-cooking-class-confirmation`;
    const edgeRes = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(body),
    });
    ...
    */

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-cooking-class-confirmation`;

    const edgeRes = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(body),
    });

    let responseData: unknown;
    try {
      responseData = await edgeRes.json();
    } catch {
      responseData = { error: `Edge function returned status ${edgeRes.status}` };
    }

    if (!edgeRes.ok) {
      const errorMessage =
        (responseData as { error?: string; message?: string })?.error ||
        (responseData as { error?: string; message?: string })?.message ||
        `Edge function failed with status ${edgeRes.status}`;

      console.error("[send-confirmation] Edge function error:", errorMessage, responseData);
      return NextResponse.json({ error: errorMessage }, { status: edgeRes.status });
    }

    console.warn(
      "[send-confirmation] Legacy untracked edge proxy used — registrationId required for DB sync"
    );
    return NextResponse.json({
      success: true,
      untracked: true,
      ...(responseData as object),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-confirmation] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
