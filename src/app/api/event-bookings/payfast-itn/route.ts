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
      console.error('[EB PayFast ITN] Signature mismatch');
      return responseOk;
    }

    const clientIp = (
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1').split(',')[0].trim();

    if (!IS_TEST && !PAYFAST_IPS.includes(clientIp)) {
      console.error('[EB PayFast ITN] Untrusted IP:', clientIp);
      return responseOk;
    }

    const valid = await validateWithPayFast({ ...pfData });
    if (!valid) return responseOk;

    const registrationCode = pfData.m_payment_id;
    if (!registrationCode) {
      console.error('[EB PayFast ITN] Missing m_payment_id');
      return responseOk;
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // ── Check if this is a pending (pre-creation) PayFast registration ────────
    const { data: pendingRow } = await supabaseAdmin
      .from('payfast_pending_payments')
      .select('payload')
      .eq('m_payment_id', registrationCode)
      .eq('payment_type', 'event_booking')
      .maybeSingle();

    if (pendingRow) {
      if (pfData.payment_status === 'COMPLETE') {
        const p = pendingRow.payload as {
          registration: Record<string, unknown>;
          selectedDateIds: string[];
        };

        // Insert the registration
        const { data: reg, error: regErr } = await supabaseAdmin
          .from('event_management_registrations')
          .insert({
            ...p.registration,
            payment_status: 'paid',
            payfast_payment_id: pfData.pf_payment_id || registrationCode,
          })
          .select('id')
          .single();

        if (regErr || !reg) {
          console.error('[EB PayFast ITN] Failed to create registration from pending:', regErr?.message);
          return responseOk;
        }

        // Insert booking counts
        if (Array.isArray(p.selectedDateIds) && p.selectedDateIds.length > 0) {
          await supabaseAdmin.from('event_management_booking_counts').insert(
            p.selectedDateIds.map((event_date_id: string) => ({
              event_date_id,
              registration_id: reg.id,
            }))
          );
        }

        // Clean up pending record
        await supabaseAdmin
          .from('payfast_pending_payments')
          .delete()
          .eq('m_payment_id', registrationCode);

        console.log('[EB PayFast ITN] Registration created from pending payment:', registrationCode);
      } else if (pfData.payment_status === 'FAILED') {
        await supabaseAdmin
          .from('payfast_pending_payments')
          .delete()
          .eq('m_payment_id', registrationCode);
        console.log('[EB PayFast ITN] Pending event booking payment failed, record removed:', registrationCode);
      }
      return responseOk;
    }

    // ── Legacy path: registration already exists (EFT or old PayFast) ─────────
    if (pfData.payment_status === 'COMPLETE') {
      await supabaseAdmin
        .from('event_management_registrations')
        .update({
          payment_status: 'paid',
          payfast_payment_id: pfData.pf_payment_id || pfData.m_payment_id,
        })
        .eq('registration_code', registrationCode);
    } else if (pfData.payment_status === 'FAILED') {
      await supabaseAdmin
        .from('event_management_registrations')
        .update({ payment_status: 'failed' })
        .eq('registration_code', registrationCode);
    }
  } catch (err) {
    console.error('[EB PayFast ITN] Exception:', err instanceof Error ? err.message : err);
  }

  return responseOk;
}
