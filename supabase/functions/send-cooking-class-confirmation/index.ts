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
      registrationId,
      registrationCode,
      fullName,
      customerEmail,
      cellphone,
      amount,
      createdAt,
      notes,
      sessionDates,
      participants,
      formHeaderTitle,
      logoUrl,
      adminEmails,
      recipientTargets,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    if (!customerEmail || typeof customerEmail !== "string" || !customerEmail.trim()) {
      throw new Error("customerEmail is required and must be a valid email address");
    }

    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const hasValue = (v: unknown): v is string =>
      typeof v === "string" && v.trim().length > 0;

    const brandName = "Cardamom Kitchen";
    const bookingRef = registrationCode || (registrationId ? String(registrationId).slice(0, 8).toUpperCase() : "—");

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

    const formatTime = (timeStr: string | null | undefined): string => {
      if (!timeStr) return "";
      try {
        const [h, m] = timeStr.split(":");
        const d = new Date();
        d.setHours(Number(h), Number(m));
        return d.toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      } catch {
        return timeStr;
      }
    };

    const logoHtml = hasValue(logoUrl)
      ? `<img src="${logoUrl}" alt="${brandName}" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px;" />`
      : "";

    // Build session dates rows
    const sessionsArray = Array.isArray(sessionDates) ? sessionDates : [];
    const sessionRowsHtml =
      sessionsArray.length > 0
        ? sessionsArray
            .map(
              (s: {
                event_name?: string;
                location?: string;
                event_date?: string;
                start_time?: string;
                end_time?: string;
                class_fee?: number;
              }) => {
                const timeStr = s.start_time
                  ? formatTime(s.start_time) + (s.end_time ? ` – ${formatTime(s.end_time)}` : "")
                  : "—";
                return `<tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px;">
                    ${s.event_name || "Cooking Class"}
                    ${s.location ? `<br/><span style="font-size: 11px; color: #8C8278;">${s.location}</span>` : ""}
                  </td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #5C5347; font-size: 13px;">${formatDate(s.event_date)}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #5C5347; font-size: 12px;">${timeStr}</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px; text-align: right; font-family: monospace; white-space: nowrap;">${formatCurrency(s.class_fee)}</td>
                </tr>`;
              }
            )
            .join("")
        : `<tr><td colspan="4" style="padding: 10px 12px; color: #8C8278; font-size: 13px;">Session details to be confirmed.</td></tr>`;

    // Build participants rows
    const participantsArray = Array.isArray(participants)
      ? participants.filter((c: { fullName?: string; full_name?: string; name?: string }) =>
          (c.fullName || c.full_name || c.name || "").trim()
        )
      : [];

    const participantsHtml =
      participantsArray.length > 0
        ? `
        <tr>
          <td style="padding: 0 32px 20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E8E0D4; border-radius: 10px; overflow: hidden;">
              <tr>
                <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                  <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">PARTICIPANTS REGISTERED</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <thead>
                      <tr style="background-color: #f9f6f2;">
                        <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Ticket #</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Full Name</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Gender</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${participantsArray
                        .map(
                          (p: {
                            fullName?: string;
                            full_name?: string;
                            name?: string;
                            ticket_number?: string;
                            gender?: string;
                            age?: string | number;
                          }) => {
                            const pName = (p.fullName || p.full_name || p.name || "").trim();
                            return `<tr>
                              <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; font-family: monospace; color: #C4622D; font-size: 12px;">${p.ticket_number || "—"}</td>
                              <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px; font-weight: 600;">${pName || "—"}</td>
                              <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; color: #5C5347; font-size: 13px;">${p.gender || "—"}</td>
                              <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; color: #5C5347; font-size: 13px;">${p.age != null && p.age !== "" ? String(p.age) : "—"}</td>
                            </tr>`;
                          }
                        )
                        .join("")}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
        : "";

    const notesHtml = hasValue(notes)
      ? `<tr>
          <td style="padding: 0 32px 20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #fde68a; border-radius: 10px; overflow: hidden; background-color: #fffbeb;">
              <tr>
                <td style="padding: 10px 16px; border-bottom: 1px solid #fde68a;">
                  <p style="margin: 0; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">SPECIAL NOTES</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 16px;">
                  <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">${notes}</p>
                </td>
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
  <title>Cooking Class Booking Confirmation — ${brandName}</title>
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
              <p style="margin: 6px 0 0 0; color: #C4622D; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Cooking &amp; Baking Classes</p>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="background-color: #f0fdf4; padding: 14px 32px; border-bottom: 1px solid #bbf7d0; text-align: center;">
              <p style="margin: 0; color: #15803d; font-size: 15px; font-weight: 700;">✅ Cooking Class Booking Confirmation</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 32px 20px 32px;">
              <p style="margin: 0; color: #5C5347; font-size: 14px; line-height: 1.7;">
                Dear <strong>${hasValue(fullName) ? fullName : "Valued Customer"}</strong>,<br/><br/>
                We are delighted to confirm your cooking class booking. Your registration has been received and your payment has been processed successfully.
              </p>
            </td>
          </tr>

          <!-- Booking Reference -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E8E0D4; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">BOOKING REFERENCE — <span style="font-family: monospace; color: #C4622D;">${bookingRef}</span></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #8C8278; width: 40%;">Registrant</td>
                        <td style="padding: 4px 0; font-size: 13px; color: #1A1612; font-weight: 600; text-align: right;">${hasValue(fullName) ? fullName : "—"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #8C8278;">Email</td>
                        <td style="padding: 4px 0; font-size: 13px; color: #5C5347; text-align: right;">${hasValue(customerEmail) ? customerEmail : "—"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #8C8278;">Contact</td>
                        <td style="padding: 4px 0; font-size: 13px; color: #5C5347; text-align: right;">${hasValue(cellphone) ? cellphone : "—"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #8C8278;">Registration Date</td>
                        <td style="padding: 4px 0; font-size: 13px; color: #5C5347; text-align: right;">${formatDate(createdAt)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Participants (if any) -->
          ${participantsHtml}

          <!-- Class Session Details -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E8E0D4; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">CLASS SESSION DETAILS</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <thead>
                        <tr style="background-color: #f9f6f2;">
                          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Class</th>
                          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Date</th>
                          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Time</th>
                          <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #8C8278; font-weight: 600; border-bottom: 1px solid #f0ebe4;">Fee</th>
                        </tr>
                      </thead>
                      <tbody>${sessionRowsHtml}</tbody>
                      <tfoot>
                        <tr>
                          <td colspan="3" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #1A1612; border-top: 2px solid #E8E0D4;">Total Amount Paid</td>
                          <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #C4622D; text-align: right; font-family: monospace; border-top: 2px solid #E8E0D4; white-space: nowrap;">${formatCurrency(amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What to Expect -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E8E0D4; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="background-color: #EDE7DA; padding: 10px 16px; border-bottom: 1px solid #E8E0D4;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 1px;">WHAT TO EXPECT</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 4px 0; font-size: 13px; color: #5C5347; line-height: 1.6;">🎟️&nbsp; Please bring this confirmation email or your booking reference on the day of the class.</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 13px; color: #5C5347; line-height: 1.6;">🕐&nbsp; Please arrive 15 minutes before the class start time. We recommend arriving early.</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 13px; color: #5C5347; line-height: 1.6;">👨‍🍳&nbsp; Aprons and all cooking equipment will be provided. Please wear comfortable clothing.</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 13px; color: #5C5347; line-height: 1.6;">📞&nbsp; For any queries, please contact us at <strong>info@cardamomkitchen.co.za</strong></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notes (if any) -->
          ${notesHtml}

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <p style="margin: 0 0 12px 0; color: #5C5347; font-size: 14px;">View your cooking class bookings:</p>
              <a href="https://cardamomkitchen.co.za/booking-query" style="display: inline-block; background-color: #C4622D; color: #ffffff; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                View My Classes →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #e9e0cf; padding: 16px 32px; border-top: 1px solid #E8E0D4; text-align: center;">
              <p style="margin: 0; color: #B5ADA5; font-size: 12px;">© ${new Date().getFullYear()} ${brandName}. Thank you for booking with us!</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // ── Resolve per-recipient send targets ───────────────────────────────────
    type RecipientKey = "customer" | "info_admin" | "main_admin";

    const adminEmailList: string[] = Array.isArray(adminEmails)
      ? adminEmails.filter((e: unknown) => typeof e === "string" && e.trim().length > 0)
      : [];

    const infoAdminEmail = adminEmailList[0] || null;
    const mainAdminEmail =
      adminEmailList.length > 1 ? adminEmailList[adminEmailList.length - 1] : null;

    const defaultTargets: Array<{ key: RecipientKey; email: string }> = [];
    if (customerEmail?.trim()) {
      defaultTargets.push({ key: "customer", email: customerEmail.trim() });
    }
    if (infoAdminEmail) {
      defaultTargets.push({ key: "info_admin", email: infoAdminEmail });
    }
    if (mainAdminEmail && mainAdminEmail !== infoAdminEmail) {
      defaultTargets.push({ key: "main_admin", email: mainAdminEmail });
    }

    const targets: Array<{ key: RecipientKey; email: string }> = Array.isArray(recipientTargets)
      ? recipientTargets
          .filter(
            (t: { key?: string; email?: string }) =>
              typeof t?.key === "string" &&
              typeof t?.email === "string" &&
              t.email.trim().length > 0
          )
          .map((t: { key: RecipientKey; email: string }) => ({
            key: t.key,
            email: t.email.trim(),
          }))
      : defaultTargets;

    if (targets.length === 0) {
      throw new Error("No recipient targets specified for confirmation email");
    }

    const results: Record<
      string,
      { sent: boolean; emailId?: string; error?: string }
    > = {};

    const sendOne = async (
      key: RecipientKey,
      toEmail: string,
      subject: string
    ): Promise<void> => {
      const payload = {
        from: RESEND_FROM_EMAIL,
        to: [toEmail],
        subject,
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
        results[key] = {
          sent: false,
          error: data.message || `Failed to send to ${toEmail}`,
        };
        return;
      }

      results[key] = { sent: true, emailId: data.id };
    };

    const customerSubject = `Cooking Class Booking Confirmed — Ref: ${bookingRef} | Cardamom Kitchen`;
    const adminSubject = `Cooking Class Booking Confirmed — ${hasValue(fullName) ? fullName : customerEmail} | Ref: ${bookingRef} | Cardamom Kitchen`;

    for (const target of targets) {
      const subject =
        target.key === "customer" ? customerSubject : adminSubject;
      await sendOne(target.key, target.email, subject);
    }

    const anySent = Object.values(results).some((r) => r.sent);
    const allFailed = Object.values(results).length > 0 && !anySent;

    if (allFailed) {
      const firstError =
        Object.values(results).find((r) => r.error)?.error ||
        "Failed to send confirmation email";
      throw new Error(firstError);
    }

    const primaryId =
      results.customer?.emailId ||
      results.info_admin?.emailId ||
      results.main_admin?.emailId;

    return new Response(
      JSON.stringify({ success: true, emailId: primaryId, results }),
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
