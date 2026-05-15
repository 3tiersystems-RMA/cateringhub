declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // ✅ CORS preflight
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
      customerName,
      customerEmail,
      orderId,
      orderTotal,
      orderDate,
      items,
      // Correspondence settings fields
      formHeaderTitle,
      logoUrl,
      termsAndConditions,
      salesRepresentative,
      officeNumber,
      comments,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const profileUrl = "https://cateringhu2257.builtwithrocket.new/customer-profile";

    const headerTitle = formHeaderTitle || "Cardamom Catering";

    const itemsHtml = Array.isArray(items) && items.length > 0
      ? items.map((item: { name: string; quantity: number; price: number }) =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #444; font-size: 14px;">${item.name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #444; font-size: 14px; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #444; font-size: 14px; text-align: right;">R ${Number(item.price).toFixed(2)}</td>
          </tr>`
        ).join("")
      : `<tr><td colspan="3" style="padding: 8px 12px; color: #888; font-size: 14px;">No items listed</td></tr>`;

    // Build optional sections
    const logoHtml = logoUrl
      ? `<tr>
          <td style="padding: 12px 32px 0 32px; text-align: center;">
            <img src="${logoUrl}" alt="${headerTitle} logo" style="max-height: 60px; max-width: 200px; object-fit: contain;" />
          </td>
        </tr>`
      : "";

    const salesRepHtml = salesRepresentative
      ? `<p style="margin: 0 0 4px 0; color: #555; font-size: 13px;">Sales Representative: <strong>${salesRepresentative}</strong></p>`
      : "";

    const officeNumberHtml = officeNumber
      ? `<p style="margin: 0 0 16px 0; color: #555; font-size: 13px;">Office: <strong>${officeNumber}</strong></p>`
      : "";

    const contactLine = officeNumber
      ? `If you have any questions, please don't hesitate to contact us (${officeNumber}). Thank you for choosing ${headerTitle}.`
      : `If you have any questions, please don't hesitate to contact us. Thank you for choosing ${headerTitle}.`;

    const commentsHtml = comments
      ? `<div style="background-color: #fff8e1; border: 1px solid #ffe082; border-radius: 4px; padding: 12px 16px; margin-bottom: 20px;">
          <p style="margin: 0; color: #7a5c00; font-size: 13px;"><strong>NOTE:</strong> ${comments}</p>
        </div>`
      : "";

    const termsHtml = termsAndConditions
      ? `<tr>
          <td style="background-color: #f9f9f9; padding: 16px 32px; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 6px 0; color: #555; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Terms &amp; Conditions</p>
            <p style="margin: 0; color: #888; font-size: 12px; line-height: 1.6; white-space: pre-line;">${termsAndConditions}</p>
          </td>
        </tr>`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Reminder</title>
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

          <!-- Logo (if provided) -->
          ${logoHtml}

          <!-- Subheader notice -->
          <tr>
            <td style="background-color: #fff8e1; padding: 12px 32px; border-bottom: 1px solid #ffe082; text-align: center;">
              <p style="margin: 0; color: #7a5c00; font-size: 13px; font-style: italic;">If payment has already been made, please ignore this Payment reminder.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 8px 0; color: #1a1a2e; font-size: 18px;">Payment Reminder</h2>
              <p style="margin: 0 0 20px 0; color: #555; font-size: 15px;">Dear ${customerName},</p>
              <p style="margin: 0 0 20px 0; color: #555; font-size: 15px;">
                We noticed that your order placed on <strong>${orderDate}</strong> has an outstanding balance. 
                Please arrange payment at your earliest convenience to ensure your order is confirmed.
              </p>

              <!-- Order Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f5f5f5; padding: 10px 12px; border-bottom: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary</p>
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
                          <td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1a1a2e; border-top: 2px solid #e0e0e0;">Total Outstanding</td>
                          <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1a1a2e; text-align: right; border-top: 2px solid #e0e0e0;">R ${Number(orderTotal).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- View Profile Link -->
              <p style="margin: 0 0 8px 0; color: #555; font-size: 15px;">
                You can view your order history and profile details by clicking the link below:
              </p>
              <p style="margin: 0 0 24px 0;">
                <a href="${profileUrl}" style="color: #1a1a2e; font-weight: 700; font-size: 15px; text-decoration: underline;">View your Profile</a>
              </p>

              <!-- Sales Rep & Office Number -->
              ${salesRepHtml}
              ${officeNumberHtml}

              <!-- Comments / NOTE -->
              ${commentsHtml}

              <p style="margin: 0; color: #555; font-size: 14px;">
                ${contactLine}
              </p>
            </td>
          </tr>

          <!-- Terms & Conditions -->
          ${termsHtml}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 16px 32px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; color: #999; font-size: 12px;">© ${new Date().getFullYear()} ${headerTitle}. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [customerEmail],
        subject: "Payment Reminder – Outstanding Balance on Your Order",
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
