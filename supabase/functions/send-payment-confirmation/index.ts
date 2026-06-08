declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

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
    const {
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      items,
      subtotal,
      deliveryFee,
      orderTotal,
      eventDate,
      deliveryAddress,
      notes,
      paymentMethod,
      createdAt,
      formHeaderTitle,
      logoUrl,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const hasValue = (v: unknown): v is string =>
      typeof v === "string" && v.trim().length > 0;

    const brandName = hasValue(formHeaderTitle) ? formHeaderTitle : "Cardamom Kitchen";

    const formatCurrency = (val: unknown): string => {
      const n = Number(val);
      return isNaN(n) ? "—" : `R ${n.toFixed(2)}`;
    };

    const formatDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return "—";
      try {
        return new Date(dateStr).toLocaleDateString("en-ZA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Africa/Johannesburg",
        });
      } catch {
        return dateStr;
      }
    };

    const orderDate = formatDate(createdAt);

    const itemsArray = Array.isArray(items) ? items : [];
    const itemsHtml =
      itemsArray.length > 0
        ? itemsArray
            .map(
              (item: { name: string; quantity: number; price: number }) =>
                `<tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px;">${item.name}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #5C5347; font-size: 13px; text-align: center;">${item.quantity}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px; text-align: right; font-family: monospace;">${formatCurrency(item.price)}</td>
                </tr>`
            )
            .join("")
        : `<tr><td colspan="3" style="padding: 10px 12px; color: #8C8278; font-size: 13px;">No items listed</td></tr>`;

    const logoHtml = hasValue(logoUrl)
      ? `<img src="${logoUrl}" alt="${brandName}" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px;" />`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Customer Payment Confirmation — ${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #e9e0cf; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e9e0cf; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 600px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1A1612; padding: 28px 32px; text-align: center;">
              ${logoHtml}
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 1px;">${brandName}</h1>
              <p style="margin: 6px 0 0 0; color: #C4622D; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Catering &amp; Meal Prep</p>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="background-color: #f0fdf4; padding: 14px 32px; border-bottom: 1px solid #bbf7d0; text-align: center;">
              <p style="margin: 0; color: #15803d; font-size: 15px; font-weight: 700;">✅ Customer Payment Confirmation</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 32px 8px 32px;">
              <p style="margin: 0 0 12px 0; color: #5C5347; font-size: 14px; line-height: 1.7;">
                Dear ${hasValue(customerName) ? customerName : "Valued Customer"},<br/><br/>
                We are pleased to confirm that your payment has been received and your order is now confirmed. Please keep this email as your payment confirmation receipt.
              </p>
            </td>
          </tr>

          <!-- Customer Information -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f6f2; border-radius: 10px; overflow: hidden; border: 1px solid #E8E0D4;">
                <tr>
                  <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">Customer Information</p>
                  </td>
                </tr>
                ${hasValue(customerName) ? `<tr><td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%;">Name</td><td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right;">${customerName}</td></tr></table></td></tr>` : ""}
                ${hasValue(customerEmail) ? `<tr><td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%;">Email</td><td style="text-align: right;"><a href="mailto:${customerEmail}" style="color: #C4622D; font-size: 13px; font-weight: 600; text-decoration: none;">${customerEmail}</a></td></tr></table></td></tr>` : ""}
                ${hasValue(customerPhone) ? `<tr><td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%;">Phone</td><td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right;">${customerPhone}</td></tr></table></td></tr>` : ""}
                <tr><td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%;">Order Date</td><td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right;">${orderDate}</td></tr></table></td></tr>
                ${hasValue(paymentMethod) ? `<tr><td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%;">Payment Method</td><td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right; text-transform: capitalize;">${paymentMethod}</td></tr></table></td></tr>` : ""}
                <tr><td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%; vertical-align: top;">Delivery Address</td><td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right;">${hasValue(deliveryAddress) && deliveryAddress !== "N/A" ? deliveryAddress : "N/A"}</td></tr></table></td></tr>
                ${hasValue(notes) ? `<tr><td style="padding: 8px 16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #8C8278; font-size: 13px; width: 40%; vertical-align: top;">Notes</td><td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right;">${notes}</td></tr></table></td></tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- Order Summary -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E8E0D4; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">ORDER SUMMARY — REF: ${orderId || "—"}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <thead>
                        <tr style="background-color: #f9f6f2;">
                          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Item</th>
                          <th style="padding: 8px 12px; text-align: center; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Qty</th>
                          <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Price</th>
                        </tr>
                      </thead>
                      <tbody>${itemsHtml}</tbody>
                      <tfoot>
                        ${subtotal != null ? `<tr><td colspan="2" style="padding: 6px 12px; font-size: 13px; color: #8C8278; border-top: 1px solid #f0ebe4;">Subtotal</td><td style="padding: 6px 12px; font-size: 13px; color: #5C5347; text-align: right; font-family: monospace; border-top: 1px solid #f0ebe4;">${formatCurrency(subtotal)}</td></tr>` : ""}
                        ${deliveryFee != null ? `<tr><td colspan="2" style="padding: 6px 12px; font-size: 13px; color: #8C8278;">Delivery Fee</td><td style="padding: 6px 12px; font-size: 13px; color: #5C5347; text-align: right; font-family: monospace;">${formatCurrency(deliveryFee)}</td></tr>` : ""}
                        <tr>
                          <td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1A1612; border-top: 2px solid #E8E0D4;">Order Total</td>
                          <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #C4622D; text-align: right; font-family: monospace; border-top: 2px solid #E8E0D4;">${formatCurrency(orderTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <p style="margin: 0 0 12px 0; color: #5C5347; font-size: 14px;">View and manage this order in the staff workspace:</p>
              <a href="https://cardamomkitchen.co.za/order-history" style="display: inline-block; background-color: #C4622D; color: #ffffff; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                Open Orders Workspace →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #e9e0cf; padding: 16px 32px; border-top: 1px solid #E8E0D4; text-align: center;">
              <p style="margin: 0; color: #B5ADA5; font-size: 12px;">© ${new Date().getFullYear()} ${brandName}. Payment confirmation notification.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const payload = {
      from: RESEND_FROM_EMAIL,
      to: [customerEmail],
      subject: `Payment Confirmed${orderId ? ` — Ref: ${orderId}` : ""} | ${brandName}`,
      html: emailHtml,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, emailId: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
