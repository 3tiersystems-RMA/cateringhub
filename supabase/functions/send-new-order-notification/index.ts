declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // CORS preflight
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
      orderTotal,
      orderDate,
      items,
      paymentMethod,
      deliveryAddress,
      notes,
      formHeaderTitle,
      logoUrl,
      // Array of email addresses to notify (info_email + admin_email)
      notifyEmails,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    if (!Array.isArray(notifyEmails) || notifyEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recipients configured" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const hasValue = (v: string | null | undefined): v is string =>
      typeof v === "string" && v.trim().length > 0;

    const headerTitle = hasValue(formHeaderTitle) ? formHeaderTitle : "Cardamom Catering";

    const itemsHtml = Array.isArray(items) && items.length > 0
      ? items.map((item: { name: string; quantity: number; price: number }) =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #444; font-size: 14px;">${item.name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #444; font-size: 14px; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #444; font-size: 14px; text-align: right;">R ${Number(item.price).toFixed(2)}</td>
          </tr>`
        ).join("")
      : `<tr><td colspan="3" style="padding: 8px 12px; color: #888; font-size: 14px;">No items listed</td></tr>`;

    const logoHtml = hasValue(logoUrl)
      ? `<tr>
          <td style="padding: 12px 32px 0 32px; text-align: center;">
            <img src="${logoUrl}" alt="${headerTitle} logo" style="max-height: 60px; max-width: 200px; object-fit: contain;" />
          </td>
        </tr>`
      : "";

    const staffOrdersUrl = "https://cateringhu2257.builtwithrocket.new/staff/orders";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Order Received</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 1px;">${headerTitle}</h1>
            </td>
          </tr>

          ${logoHtml}

          <!-- Alert Banner -->
          <tr>
            <td style="background-color: #e8f5e9; padding: 12px 32px; border-bottom: 1px solid #c8e6c9; text-align: center;">
              <p style="margin: 0; color: #2e7d32; font-size: 14px; font-weight: 700;">🛒 New Order Received</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1a1a2e; font-size: 18px;">Order Details</h2>

              <!-- Customer Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f5f5f5; padding: 10px 12px; border-bottom: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Customer Information</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px;">
                    <p style="margin: 0 0 6px 0; color: #555; font-size: 14px;"><strong>Name:</strong> ${customerName}</p>
                    <p style="margin: 0 0 6px 0; color: #555; font-size: 14px;"><strong>Email:</strong> ${customerEmail}</p>
                    ${hasValue(customerPhone) ? `<p style="margin: 0 0 6px 0; color: #555; font-size: 14px;"><strong>Phone:</strong> ${customerPhone}</p>` : ""}
                    <p style="margin: 0 0 6px 0; color: #555; font-size: 14px;"><strong>Order Date:</strong> ${orderDate}</p>
                    <p style="margin: 0 0 6px 0; color: #555; font-size: 14px;"><strong>Payment Method:</strong> ${paymentMethod}</p>
                    ${hasValue(deliveryAddress) ? `<p style="margin: 0 0 6px 0; color: #555; font-size: 14px;"><strong>Delivery Address:</strong> ${deliveryAddress}</p>` : ""}
                    ${hasValue(notes) ? `<p style="margin: 0; color: #555; font-size: 14px;"><strong>Notes:</strong> ${notes}</p>` : ""}
                  </td>
                </tr>
              </table>

              <!-- Order Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f5f5f5; padding: 10px 12px; border-bottom: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary — Ref: ${orderId}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <thead>
                        <tr style="background-color: #fafafa;">
                          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #888; font-weight: 600; border-bottom: 1px solid #f0f0f0;">Item</th>
                          <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #888; font-weight: 600; border-bottom: 1px solid #f0f0f0;">Qty</th>
                          <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #888; font-weight: 600; border-bottom: 1px solid #f0f0f0;">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1a1a2e; border-top: 2px solid #e0e0e0;">Order Total</td>
                          <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1a1a2e; text-align: right; border-top: 2px solid #e0e0e0;">R ${Number(orderTotal).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <p style="margin: 0 0 8px 0; color: #555; font-size: 15px;">
                View and manage this order in the staff workspace:
              </p>
              <p style="margin: 0;">
                <a href="${staffOrdersUrl}" style="color: #1a1a2e; font-weight: 700; font-size: 15px; text-decoration: underline;">Open Orders Workspace</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 16px 32px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; color: #999; font-size: 12px;">© ${new Date().getFullYear()} ${headerTitle}. This is an automated staff notification.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send to the first notify email; CC the rest
    const primaryRecipient = notifyEmails[0];
    const ccRecipients = notifyEmails.slice(1);

    const resendPayload: Record<string, unknown> = {
      from: "onboarding@resend.dev",
      to: [primaryRecipient],
      subject: `New Order Received – ${customerName} (R ${Number(orderTotal).toFixed(2)})`,
      html: emailHtml,
    };

    if (ccRecipients.length > 0) {
      resendPayload.cc = ccRecipients;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to send notification via Resend");
    }

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
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
