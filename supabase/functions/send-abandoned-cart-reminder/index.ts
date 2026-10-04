declare const Deno: {
  env: { get(key: string): string | undefined };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars not set");

    const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://cardamomkitchen.co.za";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find carts inactive for >= 1 hour, with an email, items, and no reminder sent yet
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: carts, error: fetchError } = await supabase
      .from("guest_carts")
      .select("*")
      .not("customer_email", "is", null)
      .lt("last_activity_at", oneHourAgo)
      .is("reminder_sent_at", null)
      .neq("items", "[]");

    if (fetchError) throw fetchError;

    const results: { token: string; status: string; email?: string }[] = [];

    for (const cart of carts ?? []) {
      if (!cart.customer_email || !Array.isArray(cart.items) || cart.items.length === 0) continue;

      const items = cart.items as Array<{ product: { name: string; price: number }; quantity: number }>;
      const subtotal = items.reduce((s: number, i: { product: { price: number }; quantity: number }) => s + i.product.price * i.quantity, 0);
      const delivery = 15;
      const total = subtotal + delivery;

      const itemsHtml = items
        .map(
          (i) =>
            `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;color:#444;font-size:14px;">${i.product.name}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;color:#444;font-size:14px;text-align:center;">${i.quantity}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;color:#444;font-size:14px;text-align:right;">R ${(i.product.price * i.quantity).toFixed(2)}</td>
            </tr>`
        )
        .join("");

      const customerName = cart.customer_name || "Valued Customer";
      const shopUrl = `${SITE_URL}/products`;

      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>You left something behind</title></head>
<body style="margin:0;padding:0;background-color:#f9f5f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f5f0;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e8ddd0;border-radius:8px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#C4622D;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Cardamom Kitchen</h1>
            <p style="margin:8px 0 0 0;color:#fde8d8;font-size:14px;">You left something delicious behind 🍽️</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px 32px;">
            <h2 style="margin:0 0 12px 0;color:#1A1612;font-size:20px;">Hi ${customerName},</h2>
            <p style="margin:0 0 20px 0;color:#5C5347;font-size:15px;line-height:1.6;">
              We noticed you left some items in your cart. Your selection is saved and ready whenever you are!
            </p>

            <!-- Cart Summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ddd0;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="background-color:#e9e0cf;padding:10px 12px;border-bottom:1px solid #e8ddd0;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#1A1612;text-transform:uppercase;letter-spacing:0.5px;">Your Cart</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <thead>
                      <tr style="background-color:#faf7f3;">
                        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#8C8278;font-weight:600;border-bottom:1px solid #f0ebe3;">Item</th>
                        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#8C8278;font-weight:600;border-bottom:1px solid #f0ebe3;">Qty</th>
                        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#8C8278;font-weight:600;border-bottom:1px solid #f0ebe3;">Price</th>
                      </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                    <tfoot>
                      <tr>
                        <td colspan="2" style="padding:8px 12px;font-size:13px;color:#5C5347;border-top:1px solid #e8ddd0;">Delivery</td>
                        <td style="padding:8px 12px;font-size:13px;color:#5C5347;text-align:right;border-top:1px solid #e8ddd0;">R ${delivery.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:10px 12px;font-size:15px;font-weight:700;color:#1A1612;border-top:2px solid #e8ddd0;">Total</td>
                        <td style="padding:10px 12px;font-size:15px;font-weight:700;color:#C4622D;text-align:right;border-top:2px solid #e8ddd0;">R ${total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px 0;color:#5C5347;font-size:14px;line-height:1.6;">
              Ready to complete your order? Click below to return to your cart.
            </p>

            <p style="margin:0 0 28px 0;text-align:center;">
              <a href="${shopUrl}" style="display:inline-block;background-color:#C4622D;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:700;">Complete My Order</a>
            </p>

            <p style="margin:0;color:#8C8278;font-size:13px;line-height:1.6;">
              If you have any questions, feel free to reach out to us. We are happy to help!
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#e9e0cf;padding:16px 32px;border-top:1px solid #e8ddd0;text-align:center;">
            <p style="margin:0;color:#8C8278;font-size:12px;">© ${new Date().getFullYear()} Cardamom Kitchen. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [cart.customer_email],
          subject: "You left something delicious behind 🍽️ — Cardamom Kitchen",
          html: emailHtml,
        }),
      });

      if (resendRes.ok) {
        await supabase
          .from("guest_carts")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("guest_token", cart.guest_token);
        results.push({ token: cart.guest_token, status: "sent", email: cart.customer_email });
      } else {
        const errData = await resendRes.json();
        results.push({ token: cart.guest_token, status: `failed: ${errData.message}` });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
