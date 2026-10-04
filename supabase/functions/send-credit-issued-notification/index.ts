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
      creditId,
      customerEmail,
      customerName,
      bookingRef,
      bookingType,
      amount,
      adminEmails,
      brandName,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const formatCurrency = (val: number): string =>
      `R ${Number(val).toFixed(2)}`;

    const bookingTypeLabel =
      bookingType === "class" ? "Cooking & Baking Class" : "Event";

    const customerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DDD5C8;max-width:600px;">
        <tr><td style="background:#C4622D;padding:28px 32px;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${brandName}</h1>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <img src="https://cardamomkitchen.co.za/assets/images/Logo-Transparent-1772539392689.png" alt="Cardamom Kitchen Logo" width="48" height="48" style="display:block;border-radius:50%;object-fit:cover;" />
                  </td>
                </tr>
              </table>
              <p style="margin:6px 0 0;color:#f5d5c5;font-size:14px;text-align:center;">Booking Credit Issued</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#1A1612;font-size:16px;margin:0 0 16px;">Dear ${customerName},</p>
          <p style="color:#5C5347;font-size:14px;line-height:1.6;margin:0 0 24px;">
            We have issued a booking credit to your account for your missed ${bookingTypeLabel} booking.
            This credit can be used against any future booking with us.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6EE;border-radius:12px;border:1px solid #E8DDD0;margin:0 0 24px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#8C8278;font-size:12px;padding-bottom:8px;">CREDIT AMOUNT</td>
                  <td align="right" style="color:#C4622D;font-size:24px;font-weight:700;padding-bottom:8px;">${formatCurrency(amount)}</td>
                </tr>
                <tr>
                  <td style="color:#8C8278;font-size:12px;padding-bottom:4px;">Original Booking Reference</td>
                  <td align="right" style="color:#1A1612;font-size:13px;font-weight:600;padding-bottom:4px;">${bookingRef}</td>
                </tr>
                <tr>
                  <td style="color:#8C8278;font-size:12px;padding-bottom:4px;">Booking Type</td>
                  <td align="right" style="color:#1A1612;font-size:13px;padding-bottom:4px;">${bookingTypeLabel}</td>
                </tr>
                <tr>
                  <td style="color:#8C8278;font-size:12px;">Expiry</td>
                  <td align="right" style="color:#1A1612;font-size:13px;">No expiry</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#5C5347;font-size:13px;line-height:1.6;margin:0 0 16px;">
            To use your credit, simply register for a future booking using this email address
            (<strong>${customerEmail}</strong>). The system will automatically detect your available
            credit and apply it to your booking.
          </p>
          <p style="color:#8C8278;font-size:12px;margin:0;">Credit Reference: ${creditId}</p>
        </td></tr>
        <tr><td style="background:#F5F0E8;padding:20px 32px;text-align:center;">
          <p style="color:#8C8278;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DDD5C8;max-width:600px;">
        <tr><td style="background:#1A1612;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${brandName} — Admin Alert</h1>
          <p style="margin:6px 0 0;color:#8C8278;font-size:13px;">Booking Credit Issued</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#1A1612;font-size:15px;font-weight:600;margin:0 0 16px;">A booking credit has been issued.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6EE;border-radius:12px;border:1px solid #E8DDD0;margin:0 0 16px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="color:#8C8278;font-size:12px;padding-bottom:6px;">Customer</td><td align="right" style="color:#1A1612;font-size:13px;font-weight:600;padding-bottom:6px;">${customerName}</td></tr>
                <tr><td style="color:#8C8278;font-size:12px;padding-bottom:6px;">Email</td><td align="right" style="color:#1A1612;font-size:13px;padding-bottom:6px;">${customerEmail}</td></tr>
                <tr><td style="color:#8C8278;font-size:12px;padding-bottom:6px;">Credit Amount</td><td align="right" style="color:#C4622D;font-size:15px;font-weight:700;padding-bottom:6px;">${formatCurrency(amount)}</td></tr>
                <tr><td style="color:#8C8278;font-size:12px;padding-bottom:6px;">Booking Ref</td><td align="right" style="color:#1A1612;font-size:13px;padding-bottom:6px;">${bookingRef}</td></tr>
                <tr><td style="color:#8C8278;font-size:12px;padding-bottom:6px;">Booking Type</td><td align="right" style="color:#1A1612;font-size:13px;padding-bottom:6px;">${bookingTypeLabel}</td></tr>
                <tr><td style="color:#8C8278;font-size:12px;">Credit ID</td><td align="right" style="color:#1A1612;font-size:11px;padding-bottom:0;">${creditId}</td></tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#8C8278;font-size:12px;margin:0;">This is an automated notification from ${brandName}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send to customer
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [customerEmail],
        subject: `Your Booking Credit — ${formatCurrency(amount)} | ${brandName}`,
        html: customerHtml,
      }),
    });

    // Send to each admin email
    const validAdminEmails = (adminEmails || []).filter(
      (e: string) => e && e.trim() && e !== customerEmail
    );
    for (const adminEmail of validAdminEmails) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [adminEmail],
          subject: `[Admin] Booking Credit Issued — ${customerName} | ${brandName}`,
          html: adminHtml,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
