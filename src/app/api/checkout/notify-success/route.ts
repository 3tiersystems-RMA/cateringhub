import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/notify-success
 * Fetches full order details + correspondence settings, then calls the
 * send-checkout-success-notification Edge Function to:
 *  1. Send an order receipt to the customer
 *  2. Send an admin notification to info_email + admin_email from Correspondence Settings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, paymentStatus, paymentMethod, isPayFastReturn, triggeredAt } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Fetch full order details if we have an orderId
    let orderDetails: Record<string, unknown> = {};
    if (orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select(
          "id, m_payment_id, customer_name, customer_email, customer_phone, items, subtotal, delivery_fee, total, payment_status, payment_method, event_date, delivery_address, notes, created_at"
        )
        .eq("m_payment_id", orderId)
        .maybeSingle();

      if (order) {
        orderDetails = order;
      }
    }

    // Fetch correspondence settings for recipient emails and branding
    const { data: corrSettings } = await supabase
      .from("correspondence_settings")
      .select("info_email, admin_email, form_header_title, logo_url")
      .limit(1)
      .maybeSingle();

    const normalize = (val: string | null | undefined): string | null => {
      if (!val || val.trim() === "") return null;
      return val.trim();
    };

    const infoEmail = normalize(corrSettings?.info_email);
    const adminEmail = normalize(corrSettings?.admin_email);
    const formHeaderTitle = normalize(corrSettings?.form_header_title) ?? "Cardamom Kitchen";
    const logoUrl = normalize(corrSettings?.logo_url);

    // Build admin recipient list
    const adminEmails: string[] = [];
    if (infoEmail) adminEmails.push(infoEmail);
    if (adminEmail && adminEmail !== infoEmail) adminEmails.push(adminEmail);

    const { data, error } = await supabase.functions.invoke(
      "send-checkout-success-notification",
      {
        body: {
          orderId,
          paymentStatus,
          paymentMethod,
          isPayFastReturn,
          triggeredAt,
          // Full order details
          customerName: orderDetails.customer_name ?? null,
          customerEmail: orderDetails.customer_email ?? null,
          customerPhone: orderDetails.customer_phone ?? null,
          items: orderDetails.items ?? [],
          subtotal: orderDetails.subtotal ?? null,
          deliveryFee: orderDetails.delivery_fee ?? null,
          orderTotal: orderDetails.total ?? null,
          eventDate: orderDetails.event_date ?? null,
          deliveryAddress: orderDetails.delivery_address ?? null,
          notes: orderDetails.notes ?? null,
          // Branding
          formHeaderTitle,
          logoUrl,
          // Recipients
          adminEmails,
        },
      }
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
