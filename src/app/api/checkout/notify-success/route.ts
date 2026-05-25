import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/checkout/notify-success
 * Calls the send-checkout-success-notification Edge Function to email
 * info@cardamomkitchen.co.za whenever /checkout/success is triggered.
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
      "send-checkout-success-notification",
      { body }
    );

    if (error) {
      console.error("[notify-success] Edge function error:", error);
      return NextResponse.json(
        { error: error.message || "Edge function failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notify-success] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
