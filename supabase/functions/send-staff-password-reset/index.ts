declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const hasValue = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

function buildHtml(params: {
  recipientName: string;
  resetLink: string;
  formHeaderTitle?: string | null;
  logoUrl?: string | null;
  officeNumber?: string | null;
}): string {
  const brandName = hasValue(params.formHeaderTitle)
    ? params.formHeaderTitle
    : "Cardamom Kitchen";
  const greeting = hasValue(params.recipientName) ? params.recipientName : "there";

  const logoHtml = hasValue(params.logoUrl)
    ? `<tr>
        <td style="padding: 16px 32px 0; text-align: center;">
          <img src="${params.logoUrl}" alt="${brandName}" style="max-height: 60px; max-width: 200px; object-fit: contain;" />
        </td>
      </tr>`
    : "";

  const contactLine = hasValue(params.officeNumber)
    ? `If you did not request this, contact us on ${params.officeNumber}.`
    : "If you did not request this, please contact your administrator.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your staff password</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f6f1;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f6f1;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e0d8cc;border-radius:8px;overflow:hidden;max-width:600px;">
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${brandName}</h1>
              <p style="margin:8px 0 0;color:#d4c5b0;font-size:13px;">Staff Portal</p>
            </td>
          </tr>
          ${logoHtml}
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#1A1612;font-size:15px;">Hi ${greeting},</p>
              <p style="margin:0 0 20px;color:#5C5347;font-size:15px;line-height:1.6;">
                A password reset was requested for your staff account. Click the button below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#C4622D;border-radius:8px;">
                    <a href="${params.resetLink}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;color:#8C8278;font-size:13px;line-height:1.6;">
                This link expires after a short time. If the button does not work, copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 20px;color:#C4622D;font-size:12px;word-break:break-all;">${params.resetLink}</p>
              <p style="margin:0;color:#8C8278;font-size:13px;line-height:1.6;">${contactLine}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#faf5ee;padding:16px 32px;border-top:1px solid #ede7da;text-align:center;">
              <p style="margin:0;color:#8C8278;font-size:12px;">&copy; ${new Date().getFullYear()} ${brandName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
      recipientEmail,
      recipientName,
      resetLink,
      formHeaderTitle,
      logoUrl,
      officeNumber,
    } = await req.json();

    if (!recipientEmail || !resetLink) {
      return new Response(
        JSON.stringify({ error: "recipientEmail and resetLink are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const brandName = hasValue(formHeaderTitle)
      ? formHeaderTitle
      : "Cardamom Kitchen";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [recipientEmail],
        subject: `Reset your ${brandName} staff password`,
        html: buildHtml({
          recipientName: recipientName || "",
          resetLink,
          formHeaderTitle,
          logoUrl,
          officeNumber,
        }),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, emailId: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
