import { NextRequest, NextResponse } from "next/server";
import { buildPaymentPayload } from "@/lib/payfast";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order, buyer } = body;

    // Basic validation
    if (!order?.paymentId || !order?.amount || !order?.itemName) {
      return NextResponse.json({ error: "Missing order fields" }, { status: 400 });
    }
    if (!buyer?.firstName || !buyer?.email) {
      return NextResponse.json({ error: "Missing buyer fields" }, { status: 400 });
    }

    // Determine base URL from request headers
    const host = req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${proto}://${host}`;

    const payload = buildPaymentPayload(order, buyer, baseUrl);

    return NextResponse.json({
      success:    true,
      gatewayUrl: payload.gatewayUrl,
      params:     payload.params,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[PayFast initiate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
