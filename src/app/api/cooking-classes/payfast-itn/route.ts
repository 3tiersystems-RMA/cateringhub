import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateITNSignature, validateWithPayFast, PAYFAST_IPS, IS_TEST } from '@/lib/payfast';

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
      '127.0.0.1' ).split(',')[0].trim();

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
      await supabaseAdmin
        .from('cooking_class_registrations')
        .update({
          payment_status: 'paid',
          payfast_payment_id: pfData.pf_payment_id || pfData.m_payment_id,
        })
        .eq('registration_code', registrationCode);

      // Trigger sheet sync
      // ── TEMPORARILY DISABLED — Google Sheets sync deactivated until further notice ──
      // try {
      //   const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cateringhu2257.builtwithrocket.new';
      //   await fetch(`${baseUrl}/api/cooking-classes/sync-sheet`, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ registrationId }),
      //   });
      // } catch (syncErr) {
      //   console.error('[CC PayFast ITN] Sheet sync failed:', syncErr);
      // }
      // ── END DISABLE BLOCK ─────────────────────────────────────────────────
    } else if (pfData.payment_status === 'FAILED') {
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
