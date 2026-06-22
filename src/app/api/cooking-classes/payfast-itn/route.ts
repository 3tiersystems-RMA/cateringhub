import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateITNSignature, validateWithPayFast, PAYFAST_IPS, IS_TEST } from '@/lib/payfast';
import { completeCookingClassPayfast } from '@/lib/cooking-class-payfast-complete';

export async function POST(req: NextRequest) {
  const responseOk = new NextResponse('OK', { status: 200 });

  try {
    const formData = await req.formData();
    const pfData: Record<string, string> = {};
    formData.forEach((value, key) => { pfData[key] = String(value); });

    const receivedSig = pfData.signature;
    if (!receivedSig) return responseOk;
    delete pfData.signature;

    if (!validateITNSignature(pfData, receivedSig)) {
      console.error('[CC PayFast ITN] Signature mismatch');
      return responseOk;
    }

    const clientIp = (
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1').split(',')[0].trim();

    if (!IS_TEST && !PAYFAST_IPS.includes(clientIp)) {
      console.error('[CC PayFast ITN] Untrusted IP:', clientIp);
      return responseOk;
    }

    const valid = await validateWithPayFast({ ...pfData });
    if (!valid) return responseOk;

    const registrationCode = pfData.m_payment_id;
    if (!registrationCode) {
      console.error('[CC PayFast ITN] Missing m_payment_id');
      return responseOk;
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    if (pfData.payment_status === 'COMPLETE') {
      const result = await completeCookingClassPayfast(
        supabaseAdmin,
        registrationCode,
        pfData.pf_payment_id || registrationCode,
        pfData
      );

      if (result.status === 'error') {
        console.error('[CC PayFast ITN] Complete failed:', result.message);
      } else if (result.status === 'created') {
        console.log('[CC PayFast ITN] Registration created from pending payment:', registrationCode);
      }
    } else if (pfData.payment_status === 'FAILED') {
      await supabaseAdmin
        .from('payfast_pending_payments')
        .delete()
        .eq('m_payment_id', registrationCode)
        .eq('payment_type', 'cooking_class');

      await supabaseAdmin
        .from('cooking_class_registrations')
        .update({ payment_status: 'failed' })
        .eq('registration_code', registrationCode);
    }
  } catch (err) {
    console.error('[CC PayFast ITN] Exception:', err instanceof Error ? err.message : err);
  }

  return responseOk;
}
