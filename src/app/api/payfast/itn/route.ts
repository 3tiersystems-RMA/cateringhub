import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  validateITNSignature,
  validateWithPayFast,
  PAYFAST_IPS,
  PAYFAST_CONFIG,
} from "@/lib/payfast";

export async function POST(req: NextRequest) {
  // Step 0: Acknowledge immediately — PayFast expects 200 quickly
  const responseOk = new NextResponse("OK", { status: 200 });

  try {
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    formData.forEach((value, key) => {
      pfData[key] = String(value);
    });

    console.log("[PayFast ITN] Received:", pfData);

    // Step 1: Validate signature
    const receivedSig = pfData.signature;
    if (!receivedSig) {
      console.error("[PayFast ITN] ❌ No signature in payload");
      return responseOk;
    }
    delete pfData.signature;

    if (!validateITNSignature(pfData, receivedSig)) {
      console.error("[PayFast ITN] ❌ Signature mismatch. Possible tampering.");
      return responseOk;
    }
    console.log("[PayFast ITN] ✅ Signature valid");

    // Step 2: Validate source IP (skip in sandbox)
    const clientIp = (
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"
    )
      .split(",")[0]
      .trim();

    if (!PAYFAST_CONFIG.isSandbox && !PAYFAST_IPS.includes(clientIp)) {
      console.error("[PayFast ITN] ❌ Untrusted IP:", clientIp);
      return responseOk;
    }
    console.log("[PayFast ITN] ✅ IP validated:", clientIp);

    // Step 3: Confirm amount matches order in DB
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const paymentId = pfData.m_payment_id;
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("total, payment_status")
      .eq("m_payment_id", paymentId)
      .single();

    if (orderErr || !orderRow) {
      console.error("[PayFast ITN] ❌ Order not found:", paymentId);
      return responseOk;
    }

    const receivedAmount = parseFloat(pfData.amount_gross);
    const expectedAmount = parseFloat(orderRow.total);

    if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
      console.error(
        `[PayFast ITN] ❌ Amount mismatch. Expected: ${expectedAmount}, Got: ${receivedAmount}`
      );
      return responseOk;
    }
    console.log("[PayFast ITN] ✅ Amount confirmed: R", receivedAmount);

    // Step 4: Query PayFast validation endpoint
    const valid = await validateWithPayFast({ ...pfData });
    if (!valid) {
      console.error("[PayFast ITN] ❌ PayFast validation failed");
      return responseOk;
    }
    console.log("[PayFast ITN] ✅ PayFast server confirmed payment");

    // Step 5: Handle payment status
    const paymentStatus = pfData.payment_status;

    if (paymentStatus === "COMPLETE") {
      console.log("[PayFast ITN] 🟢 Payment COMPLETE — fulfilling order:", paymentId);
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "payfast",
          notes: `PayFast payment confirmed. PF ID: ${pfData.pf_payment_id || ""}`,
        })
        .eq("m_payment_id", paymentId);
    } else if (paymentStatus === "FAILED") {
      console.warn("[PayFast ITN] 🔴 Payment FAILED:", paymentId);
      await supabaseAdmin
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("m_payment_id", paymentId);
    } else if (paymentStatus === "PENDING") {
      console.warn("[PayFast ITN] 🟡 Payment PENDING:", paymentId);
      // EFT via PayFast may remain pending — leave status as awaiting_payment
    } else {
      console.warn("[PayFast ITN] Unknown status:", paymentStatus);
    }
  } catch (err) {
    console.error("[PayFast ITN] Exception:", err);
  }

  return responseOk;
}
