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
      paymentStatus,
      paymentMethod,
      isPayFastReturn,
      triggeredAt,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    // General Enquiries email from the Contact page
    const GENERAL_ENQUIRIES_EMAIL = "info@cardamomkitchen.co.za";

    const displayStatus =
      paymentStatus === "COMPLETE" ? "Complete" : "Confirmed";
    const displayMethod = paymentMethod || (isPayFastReturn ? "PayFast" : "EFT");
    const formattedDate = triggeredAt
      ? new Date(triggeredAt).toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
          dateStyle: "full",
          timeStyle: "short",
        })
      : new Date().toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
          dateStyle: "full",
          timeStyle: "short",
        });

    const payFastNoteHtml = isPayFastReturn
      ? `<tr>
          <td style="padding: 12px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;">
              <tr>
                <td style="padding: 12px 16px;">
                  <p style="margin: 0; color: #1d4ed8; font-size: 13px; line-height: 1.6;">
                    ℹ️ <strong>PayFast Processing:</strong> This payment is being processed by PayFast. A confirmation email will be sent to the customer once the payment is verified.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : "";

    const orderRefHtml = orderId
      ? `<tr>
          <td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color: #8C8278; font-size: 13px; width: 50%;">Order Reference</td>
                <td style="color: #1A1612; font-size: 13px; font-weight: 700; font-family: monospace; text-align: right;">${orderId}</td>
              </tr>
            </table>
          </td>
        </tr>`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Checkout Success Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ddd4cb; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ddd4cb; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 600px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1A1612; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 1px;">Cardamom Kitchen</h1>
              <p style="margin: 6px 0 0 0; color: #C4622D; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Catering &amp; Meal Prep</p>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background-color: #f0fdf4; padding: 14px 32px; border-bottom: 1px solid #bbf7d0; text-align: center;">
              <p style="margin: 0; color: #15803d; font-size: 15px; font-weight: 700;">✅ Checkout Successful — New Payment Received</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 28px 32px 8px 32px;">
              <p style="margin: 0 0 6px 0; color: #1A1612; font-size: 15px; font-weight: 600;">Hello,</p>
              <p style="margin: 0 0 20px 0; color: #5C5347; font-size: 14px; line-height: 1.7;">
                A customer has successfully completed the checkout process on <strong>Cardamom Kitchen</strong>. The details of the transaction are shown below.
              </p>
            </td>
          </tr>

          <!-- Order Details Card -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0E8; border-radius: 10px; overflow: hidden; border: 1px solid #E8E0D4;">
                <tr>
                  <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">Transaction Summary</p>
                  </td>
                </tr>
                ${orderRefHtml}
                <tr>
                  <td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #8C8278; font-size: 13px; width: 50%;">Payment Status</td>
                        <td style="text-align: right;">
                          <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px;">● ${displayStatus}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 16px; border-bottom: 1px solid #f0ebe4;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #8C8278; font-size: 13px; width: 50%;">Payment Method</td>
                        <td style="color: #1A1612; font-size: 13px; font-weight: 700; text-align: right;">${displayMethod}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #8C8278; font-size: 13px; width: 50%;">Triggered At</td>
                        <td style="color: #1A1612; font-size: 13px; font-weight: 600; text-align: right;">${formattedDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${payFastNoteHtml}

          <!-- CTA -->
          <tr>
            <td style="padding: 8px 32px 28px 32px;">
              <p style="margin: 0 0 12px 0; color: #5C5347; font-size: 14px;">
                View and manage this order in the staff workspace:
              </p>
              <a href="https://cardamomkitchen.co.za/staff/orders" style="display: inline-block; background-color: #C4622D; color: #ffffff; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                Open Orders Workspace →
              </a>
            </td>
          </tr>

          <!-- Security Badge -->
          <tr>
            <td style="padding: 0 32px 24px 32px; text-align: center;">
              <p style="margin: 0; color: #B5ADA5; font-size: 12px;">🛡 Secure Payment · PCI DSS Compliant</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5F0E8; padding: 16px 32px; border-top: 1px solid #E8E0D4; text-align: center;">
              <p style="margin: 0; color: #B5ADA5; font-size: 12px;">© ${new Date().getFullYear()} Cardamom Kitchen. This is an automated checkout notification sent to General Enquiries.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendPayload = {
      from: RESEND_FROM_EMAIL,
      to: [GENERAL_ENQUIRIES_EMAIL],
      subject: `✅ Checkout Successful${orderId ? ` — Ref: ${orderId}` : ""} (${displayMethod})`,
      html: emailHtml,
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        resendData.message || "Failed to send notification via Resend"
      );
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
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
