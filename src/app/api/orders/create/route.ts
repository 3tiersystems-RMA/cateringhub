import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendEftOrderReceivedEmail } from "@/lib/order-confirmation-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        m_payment_id: body.m_payment_id,
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        customer_phone: body.customer_phone,
        items: body.items,
        subtotal: body.subtotal,
        delivery_fee: body.delivery_fee,
        total: body.total,
        payment_status: body.payment_status,
        payment_method: body.payment_method,
        event_date: body.event_date ?? null,
        delivery_address: body.delivery_address,
        notes: body.notes,
      })
      .select("id, m_payment_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ── Auto-notify staff/admin when a new order is placed ──
    // Fire-and-forget: do not block the order creation response
    // NOTE: PayFast orders are finalized via ITN + /checkout/success complete-pending-payment
    //       (auto confirmation email). Staff new-order alert only for EFT and voucher here.
    const paymentMethodForNotify = (body.payment_method || "").toLowerCase();
    if (paymentMethodForNotify === "eft") {
      // Customer "order received — please pay via EFT" email (aligned with class booking receipts)
      sendEftOrderReceivedEmail(supabaseAdmin, data.id).catch((err) => {
        console.error("[orders/create] EFT order received email failed:", err);
      });
    }
    if (paymentMethodForNotify !== "payfast") {
      try {
        // Fetch correspondence settings for info_email and admin_email
        const { data: corrSettings } = await supabaseAdmin
          .from("correspondence_settings")
          .select("form_header_title, logo_url, info_email, admin_email")
          .limit(1)
          .maybeSingle();

        const normalize = (val: string | null | undefined): string | null => {
          if (!val || val.trim() === "") return null;
          return val.trim();
        };

        const infoEmail = normalize(corrSettings?.info_email);
        const adminEmail = normalize(corrSettings?.admin_email);
        const formHeaderTitle = normalize(corrSettings?.form_header_title) ?? "Cardamom Catering";
        const logoUrl = normalize(corrSettings?.logo_url);

        // Build the list of notification recipients (both CC'd)
        const notifyEmails: string[] = [];
        if (infoEmail) notifyEmails.push(infoEmail);
        if (adminEmail) notifyEmails.push(adminEmail);

        if (notifyEmails.length > 0) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-new-order-notification`;

          const orderDate = new Date().toLocaleDateString("en-ZA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const notifyResponse = await fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              orderId: data.id,
              customerName: body.customer_name || "Unknown Customer",
              customerEmail: body.customer_email || "",
              customerPhone: body.customer_phone || "",
              orderTotal: body.total,
              orderDate,
              items: body.items || [],
              paymentMethod: body.payment_method || "EFT",
              deliveryAddress: body.delivery_address || "",
              notes: body.notes || "",
              formHeaderTitle,
              logoUrl,
              // Both info_email and admin_email are CC'd
              notifyEmails,
            }),
          });

          if (!notifyResponse.ok) {
            const errBody = await notifyResponse.text().catch(() => "(unreadable)");
            console.error(`[orders/create] New order notification failed (${notifyResponse.status}): ${errBody}`);
          }
        }
      } catch {
        // Notification failure must never block the order creation
      }
    }

    return NextResponse.json({ id: data.id, reference: data.m_payment_id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
