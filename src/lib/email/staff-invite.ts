import type { StaffEmailBranding } from './staff-email-delivery';

export interface StaffInviteEmailParams extends StaffEmailBranding {
  recipientEmail: string;
  recipientName: string;
  inviteLink: string;
  role: string;
}

export function buildStaffInviteHtml({
  recipientName,
  inviteLink,
  role,
  formHeaderTitle,
  logoUrl,
  officeNumber,
}: Omit<StaffInviteEmailParams, 'recipientEmail'>): string {
  const brandName = formHeaderTitle?.trim() || 'Cardamom Kitchen';
  const greeting = recipientName?.trim() || 'there';
  const roleLabel = role === 'admin' ? 'Admin' : 'Staff';

  const logoHtml = logoUrl?.trim()
    ? `<tr>
        <td style="padding: 16px 32px 0; text-align: center;">
          <img src="${logoUrl}" alt="${brandName}" style="max-height: 60px; max-width: 200px; object-fit: contain;" />
        </td>
      </tr>`
    : '';

  const contactLine = officeNumber?.trim()
    ? `Questions? Contact us on ${officeNumber.trim()}.`
    : 'Questions? Contact your administrator.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to ${brandName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f6f1;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f6f1;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e0d8cc;border-radius:8px;overflow:hidden;max-width:600px;">
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${brandName}</h1>
              <p style="margin:8px 0 0;color:#d4c5b0;font-size:13px;">Staff Portal Invitation</p>
            </td>
          </tr>
          ${logoHtml}
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#1A1612;font-size:15px;">Hi ${greeting},</p>
              <p style="margin:0 0 12px;color:#5C5347;font-size:15px;line-height:1.6;">
                You've been invited to join the <strong>${brandName}</strong> staff portal as <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 20px;color:#5C5347;font-size:15px;line-height:1.6;">
                Click the button below to set your password and access the workspace.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#C4622D;border-radius:8px;">
                    <a href="${inviteLink}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;color:#8C8278;font-size:13px;line-height:1.6;">
                If the button does not work, copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 20px;color:#C4622D;font-size:12px;word-break:break-all;">${inviteLink}</p>
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

export async function sendStaffInviteViaResend(
  params: StaffInviteEmailParams
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const brandName = params.formHeaderTitle?.trim() || 'Cardamom Kitchen';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.recipientEmail],
      subject: `You're invited to ${brandName} staff portal`,
      html: buildStaffInviteHtml(params),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to send email via Resend');
  }

  return { id: data.id };
}
