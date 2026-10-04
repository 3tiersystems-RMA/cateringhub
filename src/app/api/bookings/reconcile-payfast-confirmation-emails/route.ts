import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffMember } from "@/lib/api/staff-auth";
import { reconcilePayfastConfirmationEmails } from "@/lib/booking-payfast-confirmation-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/reconcile-payfast-confirmation-emails
 * Staff-only safety net for paid PayFast class/event registrations missing confirmation email.
 * Does not touch manual EFT confirmation flows.
 */
export async function POST(req: NextRequest) {
  const auth = await requireStaffMember();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const maxAgeDays = Number(body?.maxAgeDays ?? 7);
    const limit = Number(body?.limit ?? 50);

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const result = await reconcilePayfastConfirmationEmails(supabaseAdmin, {
      maxAgeDays: Number.isFinite(maxAgeDays) ? maxAgeDays : 7,
      limit: Number.isFinite(limit) ? Math.min(limit, 100) : 50,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[reconcile-payfast-confirmation-emails]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
