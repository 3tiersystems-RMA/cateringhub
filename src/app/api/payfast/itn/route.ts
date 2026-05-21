import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  validateITNSignature,
  validateWithPayFast,
  PAYFAST_IPS,
  IS_TEST,
} from "@/lib/payfast";

/** Safe ITN log fields only — never log full POST (contains PII / payment data). */
function itnLogFields(pfData: Record<string, string>) {
  return {
    m_payment_id: pfData.m_payment_id,
    payment_status: pfData.payment_status,
    pf_payment_id: pfData.pf_payment_id,
    amount_gross: pfData.amount_gross,
  };
}

export async function POST(req: NextRequest) {
  const responseOk = new NextResponse("OK", { status: 200 });

  try {
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    formData.forEach((value, key) => {
      pfData[key] = String(value);
    });

    console.log("[PayFast ITN] Received:", itnLogFields(pfData));

    const receivedSig = pfData.signature;
    if (!receivedSig) {
      console.error("[PayFast ITN] No signature in payload");
      return responseOk;
    }
    delete pfData.signature;

    if (!validateITNSignature(pfData, receivedSig)) {
      console.error("[PayFast ITN] Signature mismatch for", pfData.m_payment_id);
      return responseOk;
    }

    const clientIp = (
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"
    )
      .split(",")[0]
      .trim();

    if (!IS_TEST && !PAYFAST_IPS.includes(clientIp)) {
      console.error("[PayFast ITN] Untrusted IP:", clientIp);
      return responseOk;
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const paymentId = pfData.m_payment_id;
    if (!paymentId) {
      console.error("[PayFast ITN] Missing m_payment_id");
      return responseOk;
    }

    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("total, payment_status")
      .eq("m_payment_id", paymentId)
      .single();

    if (orderErr || !orderRow) {
      console.error("[PayFast ITN] Order not found:", paymentId);
      return responseOk;
    }

    if (orderRow.payment_status === "paid") {
      console.log("[PayFast ITN] Order already paid, ignoring duplicate:", paymentId);
      return responseOk;
    }

    const receivedAmount = parseFloat(pfData.amount_gross);
    const expectedAmount = parseFloat(String(orderRow.total));

    if (Number.isNaN(receivedAmount) || Math.abs(receivedAmount - expectedAmount) > 0.01) {
      console.error(
        `[PayFast ITN] Amount mismatch for ${paymentId}. Expected: ${expectedAmount}, Got: ${receivedAmount}`
      );
      return responseOk;
    }

    const valid = await validateWithPayFast({ ...pfData });
    if (!valid) {
      console.error("[PayFast ITN] PayFast validation failed:", paymentId);
      return responseOk;
    }

    const paymentStatus = pfData.payment_status;

    switch (paymentStatus) {
      case "COMPLETE":
        console.log("[PayFast ITN] Payment COMPLETE:", paymentId);
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "paid",
            payment_method: "payfast",
            notes: `PayFast payment confirmed. PF ID: ${pfData.pf_payment_id || ""}`,
          })
          .eq("m_payment_id", paymentId);
        break;

      case "FAILED":
        console.warn("[PayFast ITN] Payment FAILED:", paymentId);
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("m_payment_id", paymentId);
        break;

      case "PENDING":
        console.warn("[PayFast ITN] Payment PENDING:", paymentId);
        break;

      default:
        console.warn("[PayFast ITN] Unknown status:", paymentStatus, paymentId);
    }
  } catch (err) {
    console.error("[PayFast ITN] Exception:", err instanceof Error ? err.message : err);
  }

  return responseOk;
}
