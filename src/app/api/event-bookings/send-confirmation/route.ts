import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * POST /api/event-bookings/send-confirmation
 * Server-side proxy that calls the send-event-booking-confirmation Edge Function.
 * Using the server-side Supabase SDK avoids CORS / "Failed to fetch" issues
 * that occur when the client calls the Edge Function URL directly.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

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

    return NextResponse.json({ success: true, ...(data ?? {}) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-event-booking-confirmation] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
