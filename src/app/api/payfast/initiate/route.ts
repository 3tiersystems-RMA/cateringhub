import { NextRequest, NextResponse } from "next/server";
import {
  PAYFAST_CONFIG,
  getPayFastHost,
  buildPayFastFormData,
  generateSignature,
  generateOrderId,
} from "@/lib/payfast";

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
      // Extended order data
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
        return "0" + stripped.slice(3); // +27821234567 → 0821234567
      }
      if (/^0[0-9]{9}$/.test(stripped)) {
        return stripped; // already correct
      }
      return ""; // invalid — omit from payload
    };
    const cellNumber = normalizeCellNumber(phone || "");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cateringhu2257.builtwithrocket.new";

    // Encode order data for ITN webhook
    const orderPayload = {
      customerName: name,
      customerEmail: email,
      customerPhone: phone || '',
      items: items || [],
      subtotal: subtotal || 0,
      deliveryFee: deliveryFee || 0,
      total: total || parseFloat(amount),
      eventDate: eventDate || '',
      deliveryAddress: deliveryAddress || '',
      notes: notes || '',
    };
    const encodedOrderData = encodeURIComponent(JSON.stringify(orderPayload));

    const formData = buildPayFastFormData({
      merchantId: PAYFAST_CONFIG.merchantId,
      merchantKey: PAYFAST_CONFIG.merchantKey,
      returnUrl: `${appUrl}/checkout/success?order_id=${orderId}`,
      cancelUrl: `${appUrl}/checkout/cancel?order_id=${orderId}`,
      notifyUrl: `${appUrl}/api/payfast/itn`,
      nameFirst,
      nameLast,
      emailAddress: email,
      cellNumber: cellNumber,
      mPaymentId: orderId,
      amount: parseFloat(amount).toFixed(2),
      itemName: itemName || "CateringHub Order",
      itemDescription: itemDescription || "",
      customStr1: orderId,
      customStr2: encodedOrderData.slice(0, 255),
      emailConfirmation: "1",
      confirmationAddress: email,
    });

    const signature = generateSignature(formData, PAYFAST_CONFIG.passphrase || undefined);
    formData.signature = signature;

    const pfHost = getPayFastHost();
    const actionUrl = `https://${pfHost}/eng/process`;

    return NextResponse.json({
      success: true,
      orderId,
      actionUrl,
      formData,
    });
  } catch (error) {
    console.error("PayFast initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
