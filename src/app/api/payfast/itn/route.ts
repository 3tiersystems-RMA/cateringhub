import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  validateITNSignature,
  validateWithPayFast,
  PAYFAST_IPS,
  IS_TEST,
} from "@/lib/payfast";
import { completeOrderPayfast } from "@/lib/order-payfast-complete";
import { recordFailedOrderPayment } from "@/lib/order-payfast-failed";
import { maybeSendPayfastOrderConfirmationEmail } from "@/lib/order-confirmation-email";

export async function POST(req: NextRequest) {
  const responseOk = new NextResponse("OK", { status: 200 });

  try {
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    formData.forEach((value, key) => {
      pfData[key] = String(value);
    });

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

    const paymentStatus = pfData.payment_status;
    const payfastPaymentId = pfData.pf_payment_id || null;

    // ── Pending (pre-creation) PayFast order — aligned with class/event ITN flow ──
    const { data: pendingRow } = await supabaseAdmin
      .from("payfast_pending_payments")
      .select("payload")
      .eq("m_payment_id", paymentId)
      .eq("payment_type", "order")
      .maybeSingle();

    if (pendingRow) {
      if (paymentStatus === "COMPLETE") {
        const p = pendingRow.payload as Record<string, unknown>;

        const receivedAmount = parseFloat(pfData.amount_gross);
        const expectedAmount = parseFloat(String(p.total));
        if (Number.isNaN(receivedAmount) || Math.abs(receivedAmount - expectedAmount) > 0.01) {
          console.error(
            `[PayFast ITN] Amount mismatch for pending order ${paymentId}. Expected: ${expectedAmount}, Got: ${receivedAmount}`
          );
          return responseOk;
        }

        const valid = await validateWithPayFast({ ...pfData });
        if (!valid) {
          console.error("[PayFast ITN] PayFast validation failed for pending order:", paymentId);
          return responseOk;
        }

        const result = await completeOrderPayfast(
          supabaseAdmin,
          paymentId,
          "payfast-itn",
          payfastPaymentId
        );

        if (result.status === "error") {
          console.error("[PayFast ITN] Failed to create order from pending:", result.message);
          return responseOk;
        }

        if (result.status !== "not_found") {
          const emailResult = await maybeSendPayfastOrderConfirmationEmail(
            supabaseAdmin,
            result,
            "payfast-itn"
          );
          if (!emailResult.sent && !emailResult.skipped) {
            console.error(
              "[PayFast ITN] Order created but confirmation email failed:",
              paymentId,
              emailResult.error
            );
          }
          console.log("[PayFast ITN] Order finalized from pending payment:", paymentId);
        }
      } else if (paymentStatus === "FAILED") {
        await recordFailedOrderPayment(supabaseAdmin, {
          mPaymentId: paymentId,
          payfastPaymentId,
          testSource: "payfast-itn",
        });
        console.log("[PayFast ITN] Pending order payment failed, recorded:", paymentId);
      }
      // PENDING status: keep pending record
      return responseOk;
    }

    // ── Legacy path: order already exists in DB (EFT orders or old PayFast orders) ──
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, total, payment_status")
      .eq("m_payment_id", paymentId)
      .single();

    if (orderErr || !orderRow) {
      console.error("[PayFast ITN] Order not found:", paymentId);
      return responseOk;
    }

    if (orderRow.payment_status === "paid") {
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

    switch (paymentStatus) {
      case "COMPLETE": {
        const result = await completeOrderPayfast(
          supabaseAdmin,
          paymentId,
          "payfast-itn",
          payfastPaymentId
        );
        if (result.status !== "not_found" && result.status !== "error") {
          const emailResult = await maybeSendPayfastOrderConfirmationEmail(
            supabaseAdmin,
            result,
            "payfast-itn"
          );
          if (!emailResult.sent && !emailResult.skipped) {
            console.error(
              "[PayFast ITN] Legacy order updated but confirmation email failed:",
              paymentId,
              emailResult.error
            );
          }
        }
        break;
      }

      case "FAILED":
        await recordFailedOrderPayment(supabaseAdmin, {
          mPaymentId: paymentId,
          payfastPaymentId,
          testSource: "payfast-itn",
        });
        break;

      case "PENDING":
        break;

      default:
        break;
    }
  } catch (err) {
    console.error("[PayFast ITN] Exception:", err instanceof Error ? err.message : err);
  }

  return responseOk;
}
