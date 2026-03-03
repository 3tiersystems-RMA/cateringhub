import { NextRequest, NextResponse } from "next/server";
import { PAYFAST_CONFIG, getPayFastHost, validateITNSignature, ITNPayload } from "@/lib/payfast";

async function validatePayFastIP(req: NextRequest): Promise<boolean> {
  const validHosts = [
    "www.payfast.co.za",
    "sandbox.payfast.co.za",
    "w1w.payfast.co.za",
    "w2w.payfast.co.za",
  ];

  // In sandbox mode, skip IP validation
  if (PAYFAST_CONFIG.sandbox) return true;

  const referer = req.headers.get("referer") || "";
  try {
    const refererHost = new URL(referer).hostname;
    return validHosts.includes(refererHost);
  } catch {
    return false;
  }
}

async function validateWithPayFast(
  pfParamString: string,
  pfHost: string
): Promise<boolean> {
  try {
    const validateUrl = `https://${pfHost}/eng/query/validate`;
    const response = await fetch(validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: pfParamString,
    });
    const text = await response.text();
    return text.trim() === "VALID";
  } catch (error) {
    console.error("PayFast server validation error:", error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Return 200 immediately to acknowledge receipt
    const formData = await req.formData();
    const pfData: ITNPayload = {} as ITNPayload;
    let pfParamString = "";

    formData.forEach((value, key) => {
      (pfData as Record<string, string>)[key] = value.toString();
    });

    // Build param string (exclude signature)
    for (const key in pfData) {
      if (key !== "signature") {
        pfParamString += `${key}=${encodeURIComponent(pfData[key] || "").replace(/%20/g, "+")}&`;
      } else {
        break;
      }
    }
    pfParamString = pfParamString.slice(0, -1);

    const pfHost = getPayFastHost();

    // Security Check 1: Validate signature
    const signatureValid = validateITNSignature(
      pfData,
      PAYFAST_CONFIG.passphrase || undefined
    );

    // Security Check 2: Validate IP (skip in sandbox)
    const ipValid = await validatePayFastIP(req);

    // Security Check 3: Validate merchant ID
    const merchantValid = pfData.merchant_id === PAYFAST_CONFIG.merchantId;

    // Security Check 4: Server-side validation with PayFast
    const serverValid = await validateWithPayFast(pfParamString, pfHost);

    if (!signatureValid || !ipValid || !merchantValid || !serverValid) {
      console.error("PayFast ITN validation failed:", {
        signatureValid,
        ipValid,
        merchantValid,
        serverValid,
      });
      return new NextResponse("INVALID", { status: 200 });
    }

    const { payment_status, m_payment_id, pf_payment_id, amount_gross } = pfData;

    if (payment_status === "COMPLETE") {
      console.log(`PayFast payment COMPLETE: Order ${m_payment_id}, PF ID: ${pf_payment_id}, Amount: R${amount_gross}`);
      // TODO: Update order status in your database here
      // e.g., await supabase.from('orders').update({ status: 'paid' }).eq('order_id', m_payment_id)
    } else if (payment_status === "CANCELLED") {
      console.log(`PayFast payment CANCELLED: Order ${m_payment_id}`);
      // TODO: Handle cancellation in your database
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("PayFast ITN error:", error);
    return new NextResponse("ERROR", { status: 200 }); // Always return 200 to PayFast
  }
}
