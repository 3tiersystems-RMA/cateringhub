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
      orderRef,
      customerName,
      customerEmail,
      items,
      subtotal,
      deliveryFee,
      orderTotal,
      eventDate,
      deliveryAddress,
      notes,
      formHeaderTitle,
      logoUrl,
      bankingDetails,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const RESEND_FROM_EMAIL =
      Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const hasValue = (v: unknown): v is string =>
      typeof v === "string" && v.trim().length > 0;

    if (!hasValue(customerEmail)) {
      throw new Error("Missing customer email");
    }

    const brandName = hasValue(formHeaderTitle) ? formHeaderTitle : "Cardamom Kitchen";

    const formatCurrency = (val: unknown): string => {
      const n = Number(val);
      return Number.isNaN(n) ? "—" : `R ${n.toFixed(2)}`;
    };

    const itemsArray = Array.isArray(items) ? items : [];
    const itemsHtml =
      itemsArray.length > 0
        ? itemsArray
            .map(
              (item: { name: string; quantity: number; price: number }) =>
                `<tr>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px;">${item.name}</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; color: #5C5347; font-size: 13px; text-align: center;">${item.quantity}</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #f0ebe4; color: #1A1612; font-size: 13px; text-align: right; font-family: monospace;">${formatCurrency(item.price)}</td>
                </tr>`
            )
            .join("")
        : `<tr><td colspan="3" style="padding: 8px 12px; color: #8C8278; font-size: 13px;">No items listed</td></tr>`;

    const logoHtml = hasValue(logoUrl)
      ? `<img src="${logoUrl}" alt="${brandName}" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px;" />`
      : "";

    const bankingHtml = hasValue(bankingDetails)
      ? `<tr>
          <td style="padding: 0 32px 20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
              <tr>
                <td style="padding: 14px 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">Banking Details (EFT)</p>
                  <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6; white-space: pre-line;">${bankingDetails}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Order Received — ${brandName}</title></head>
<body style="margin:0;padding:0;background-color:#e9e0cf;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#e9e0cf;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background-color:#1A1612;padding:28px 32px;text-align:center;">
            ${logoHtml}
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${brandName}</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fef3c7;padding:14px 32px;text-align:center;border-bottom:1px solid #fde68a;">
            <p style="margin:0;color:#92400e;font-size:15px;font-weight:700;">Order Received — Awaiting EFT Payment</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 12px 32px;">
            <p style="margin:0 0 12px 0;color:#5C5347;font-size:14px;line-height:1.7;">
              Hi${hasValue(customerName) ? ` ${customerName}` : ""}, thank you for your order. Please complete your EFT payment using the banking details below. We will send a payment confirmation once your transfer has been received.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#e9e0cf;border-radius:10px;border:1px solid #E8E0D4;">
              <tr><td style="padding:10px 16px;border-bottom:1px solid #E8E0D4;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#8C8278;text-transform:uppercase;">Order Reference</p>
                <p style="margin:4px 0 0 0;font-family:monospace;font-weight:700;color:#C4622D;">${orderRef || "—"}</p>
              </td></tr>
              <tr><td style="padding:10px 16px;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#8C8278;text-transform:uppercase;">Order Total</p>
                <p style="margin:4px 0 0 0;font-size:18px;font-weight:700;color:#1A1612;">${formatCurrency(orderTotal)}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        ${bankingHtml}
        <tr>
          <td style="padding:0 32px 20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D4;border-radius:10px;overflow:hidden;">
              <thead><tr style="background-color:#EDE7DA;">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#8C8278;">Item</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#8C8278;">Qty</th>
                <th style="padding:8px 12px;text-align:right;font-size:11px;color:#8C8278;">Price</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                ${subtotal != null ? `<tr><td colspan="2" style="padding:6px 12px;font-size:13px;color:#8C8278;">Subtotal</td><td style="padding:6px 12px;text-align:right;font-family:monospace;">${formatCurrency(subtotal)}</td></tr>` : ""}
                ${deliveryFee != null ? `<tr><td colspan="2" style="padding:6px 12px;font-size:13px;color:#8C8278;">Delivery</td><td style="padding:6px 12px;text-align:right;font-family:monospace;">${formatCurrency(deliveryFee)}</td></tr>` : ""}
              </tfoot>
            </table>
          </td>
        </tr>
        ${
          hasValue(deliveryAddress)
            ? `<tr><td style="padding:0 32px 16px 32px;"><p style="margin:0;font-size:13px;color:#5C5347;"><strong>Delivery:</strong> ${deliveryAddress}</p></td></tr>`
            : ""
        }
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <a href="https://cardamomkitchen.co.za/order-history" style="display:inline-block;background-color:#C4622D;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">View Order History</a>
          </td>
        </tr>
        <tr>
          <td style="background-color:#e9e0cf;padding:16px 32px;text-align:center;border-top:1px solid #E8E0D4;">
            <p style="margin:0;color:#B5ADA5;font-size:12px;">© ${new Date().getFullYear()} ${brandName}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [customerEmail],
        subject: `Order Received — Please Complete EFT${orderRef ? ` | Ref: ${orderRef}` : ""} | ${brandName}`,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
