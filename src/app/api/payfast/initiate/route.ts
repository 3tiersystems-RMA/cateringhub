import { NextRequest, NextResponse } from "next/server";
import { buildPaymentPayload, getPayFastBaseUrl, PAYFAST_MODE, validateBuyerEmailForPayFast } from "@/lib/payfast";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order, buyer, returnUrl, cancelUrl, notifyUrl } = body;

    // Basic validation
    if (!order?.paymentId || !order?.itemName) {
      return NextResponse.json({ error: "Missing order fields" }, { status: 400 });
    }
    const amount = Number(order.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }
    if (!buyer?.firstName || !buyer?.email) {
      return NextResponse.json({ error: "Missing buyer fields" }, { status: 400 });
    }

    const emailError = validateBuyerEmailForPayFast(buyer.email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    const host = req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = getPayFastBaseUrl({ proto, host });

    const payload = buildPaymentPayload(
      { ...order, amount },
      buyer,
      baseUrl,
      { returnUrl, cancelUrl, notifyUrl }
    );

    return NextResponse.json({
      success:    true,
      env:        PAYFAST_MODE,
      gatewayUrl: payload.gatewayUrl,
      params:     payload.params,
      fields:     payload.fields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[PayFast initiate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
