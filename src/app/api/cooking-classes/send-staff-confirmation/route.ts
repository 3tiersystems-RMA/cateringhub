import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminOrAbove } from "@/lib/api/staff-auth";
import { sendCookingClassConfirmationEmail } from "@/lib/cooking-class-confirmation-send";
import { ensurePayfastDeliveryStatusSynced, syncCoAdminRecipientStatus } from "@/lib/booking-payfast-confirmation-email";
import type { ConfirmationRecipientKey } from "@/lib/confirmation-email-recipients";

export const dynamic = "force-dynamic";

const VALID_TARGETS: ConfirmationRecipientKey[] = [
  "customer",
  "info_admin",
  "main_admin",
];

/**
 * POST /api/cooking-classes/send-staff-confirmation
 * Staff sends cooking class confirmation to selected registrant/admin copies.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminOrAbove();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const registrationId = String(body?.registrationId || "").trim();
    const forceResend = Boolean(body?.forceResend);
    const rawTargets = Array.isArray(body?.targets) ? body.targets : null;

    if (!registrationId) {
      return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
    }

    const targets =
      rawTargets && rawTargets.length > 0
        ? (rawTargets.filter((t: string) =>
            VALID_TARGETS.includes(t as ConfirmationRecipientKey)
          ) as ConfirmationRecipientKey[])
        : undefined;

    if (rawTargets && rawTargets.length > 0 && (!targets || targets.length === 0)) {
      return NextResponse.json(
        { error: "targets must include customer, info_admin, and/or main_admin" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: reg } = await supabaseAdmin
      .from("cooking_class_registrations")
      .select("payment_status")
      .eq("id", registrationId)
      .maybeSingle();

    if (!reg) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (!["paid", "awaiting_confirmation"].includes(reg.payment_status || "")) {
      return NextResponse.json(
        { error: "Confirmation can only be sent for paid or awaiting confirmation registrations" },
        { status: 400 }
      );
    }

    let result = await sendCookingClassConfirmationEmail(supabaseAdmin, registrationId, {
      targets,
      forceResend,
    });

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

    if (result.sent) {
      await syncCoAdminRecipientStatus(supabaseAdmin, "cooking_class", registrationId);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[send-staff-confirmation]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
