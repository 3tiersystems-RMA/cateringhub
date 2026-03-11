import { NextRequest, NextResponse } from "next/server";
import {
  PAYFAST_CONFIG,
  getPayFastHost,
  buildPayFastFormData,
  generateSignature,
  generateOrderId,
} from "@/lib/payfast";
import { APP_NAME } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      amount,
      itemName,
      itemDescription,
      items,
      subtotal,
      deliveryFee,
      total,
      eventDate,
      deliveryAddress,
      notes,
    } = body;

    if (!name || !email || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!PAYFAST_CONFIG.merchantId || !PAYFAST_CONFIG.merchantKey) {
      return NextResponse.json(
        { error: "PayFast credentials not configured" },
        { status: 500 }
      );
    }

    const orderId = generateOrderId();
    const nameParts = name.trim().split(" ");
    const nameFirst = nameParts[0] || name;
    const nameLast = nameParts.slice(1).join(" ") || "";

    // Normalize cell number to PayFast format: 0XXXXXXXXX (10 digits)
    const normalizeCellNumber = (raw: string): string => {
      const stripped = raw.replace(/[\s\-()]/g, "");
      if (/^\+27[0-9]{9}$/.test(stripped)) {
        return "0" + stripped.slice(3);
      }
      if (/^0[0-9]{9}$/.test(stripped)) {
        return stripped;
      }
      return "";
    };
    const cellNumber = normalizeCellNumber(phone || "");

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://cateringhu2257.builtwithrocket.new";

    // Build form data in exact PayFast-specified parameter order
    const formData = buildPayFastFormData({
      merchantId: PAYFAST_CONFIG.merchantId,
      merchantKey: PAYFAST_CONFIG.merchantKey,
      returnUrl: `${appUrl}/checkout/success?order_id=${orderId}`,
      cancelUrl: `${appUrl}/checkout/cancel?order_id=${orderId}`,
      notifyUrl: `${appUrl}/api/payfast/itn`,
      nameFirst,
      nameLast,
      emailAddress: email,
      cellNumber: cellNumber || undefined,
      mPaymentId: orderId,
      amount: parseFloat(amount).toFixed(2),
      itemName: itemName || `${APP_NAME} Order`,
      itemDescription: itemDescription || undefined,
      customStr1: orderId,
    });

    const signature = generateSignature(
      formData,
      PAYFAST_CONFIG.passphrase || undefined
    );

    const pfHost = getPayFastHost();
    const actionUrl = `https://${pfHost}/eng/process`;

    // Build hidden input fields for the form
    const allFields = { ...formData, signature };
    const hiddenInputs = Object.entries(allFields)
      .map(
        ([key, value]) =>
          `<input type="hidden" name="${key}" value="${value?.replace(/"/g, "&quot;")}" />`
      )
      .join("\n");

    // Return a full HTML page that auto-submits the form on load — exactly as PayFast specifies
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirecting to PayFast...</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F0E8; }
    .msg { text-align: center; color: #5C5347; }
    .spinner { width: 40px; height: 40px; border: 4px solid #DDD5C8; border-top-color: #C4622D; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body onload="document.payfast_form.submit();">
  <div class="msg">
    <div class="spinner"></div>
    <p>Redirecting to PayFast secure payment...</p>
  </div>
  <form action="${actionUrl}" method="post" name="payfast_form">
    ${hiddenInputs}
  </form>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("PayFast initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
