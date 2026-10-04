import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Internal API route for sending admin alert emails.
 * Called by /api/distance when a delivery calculation error occurs.
 * Uses Resend (same as the Supabase edge functions).
 */
export async function POST(req: NextRequest) {
  try {
    const {
      adminEmail,
      headerTitle,
      subject,
      errorDetail,
      context,
      timestamp,
      siteUrl,
    } = await req.json();

    if (!adminEmail) {
      return NextResponse.json({ error: 'adminEmail is required' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.warn('[admin-alert] RESEND_API_KEY not set — skipping email notification');
      return NextResponse.json({ success: false, message: 'RESEND_API_KEY not configured' });
    }

    const RESEND_FROM_EMAIL =
      process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const title = headerTitle || 'Cardamom Catering';
    const staffUrl = `${siteUrl || ''}/staff/workspace`;
    const formattedTime = timestamp
      ? new Date(timestamp).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
      : new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">${title}</h1>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background-color:#fff3cd;padding:12px 32px;border-bottom:1px solid #ffc107;text-align:center;">
              <p style="margin:0;color:#856404;font-size:14px;font-weight:700;">⚠️ System Alert – Delivery Calculation Error</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <p style="margin:0 0 16px 0;color:#333;font-size:15px;">
                An error occurred during a customer's delivery cost calculation. The system automatically applied the default delivery charge so the customer could continue placing their order.
              </p>

              <!-- Error Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f5f5f5;padding:10px 12px;border-bottom:1px solid #e0e0e0;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.5px;">Error Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 10px 0;color:#555;font-size:14px;"><strong>Error:</strong> ${errorDetail}</p>
                    ${context ? `<p style="margin:0 0 10px 0;color:#555;font-size:14px;"><strong>Context:</strong> ${context}</p>` : ''}
                    <p style="margin:0;color:#555;font-size:14px;"><strong>Time (SAST):</strong> ${formattedTime}</p>
                  </td>
                </tr>
              </table>

              <!-- Recommended Actions -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f5f5f5;padding:10px 12px;border-bottom:1px solid #e0e0e0;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.5px;">Recommended Actions</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px;">
                    <ul style="margin:0;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
                      <li>Verify that <strong>GOOGLE_MAPS_SERVER_KEY</strong> is set in the environment variables.</li>
                      <li>Confirm the <strong>Distance Matrix API</strong> is enabled in Google Cloud Console.</li>
                      <li>Check that billing is active on the Google Cloud project.</li>
                      <li>Review the <strong>Default Delivery Charge</strong> in Correspondence Settings to ensure it is appropriate.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;color:#555;font-size:15px;">
                Review and update settings in the staff workspace:
              </p>
              <p style="margin:0;">
                <a href="${staffUrl}" style="color:#1a1a2e;font-weight:700;font-size:15px;text-decoration:underline;">Open Staff Workspace</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f5f5f5;padding:16px 32px;border-top:1px solid #e0e0e0;text-align:center;">
              <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} ${title}. This is an automated system alert.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [adminEmail],
        subject,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('[admin-alert] Resend error:', resendData);
      return NextResponse.json(
        { success: false, error: resendData.message || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: resendData.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-alert] Unexpected error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
