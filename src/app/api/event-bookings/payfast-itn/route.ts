import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateITNSignature, validateWithPayFast, PAYFAST_IPS, IS_TEST } from '@/lib/payfast';
import { completeEventBookingPayfast } from '@/lib/event-booking-payfast-complete';
import { recordFailedBookingPayment } from '@/lib/booking-payfast-failed';
import { maybeSendPayfastBookingConfirmationEmail } from '@/lib/booking-payfast-confirmation-email';

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
        const result = await completeEventBookingPayfast(
          supabaseAdmin,
          registrationCode,
          pfData.pf_payment_id || registrationCode,
          'payfast-itn'
        );

        if (result.status === 'created') {
          console.log('[EB PayFast ITN] Registration created from pending payment:', registrationCode);
        } else if (result.status === 'already_paid') {
          console.log('[EB PayFast ITN] Pending payment already fulfilled:', registrationCode);
        } else if (result.status === 'updated') {
          console.log('[EB PayFast ITN] Registration marked paid:', registrationCode);
        } else if (result.status === 'error') {
          console.error('[EB PayFast ITN] Failed to create registration from pending:', result.message);
        }

        await maybeSendPayfastBookingConfirmationEmail(supabaseAdmin, 'event', result, 'payfast-itn');
      } else if (pfData.payment_status === 'FAILED') {
        const failResult = await recordFailedBookingPayment(supabaseAdmin, {
          bookingType: 'event',
          mPaymentId: registrationCode,
          payfastPaymentId: pfData.pf_payment_id || null,
          testSource: 'payfast-itn',
        });
        if (failResult.status === 'error') {
          console.error('[EB PayFast ITN] Failed to record failed payment:', failResult.message);
        } else {
          console.log('[EB PayFast ITN] Failed payment transaction recorded:', registrationCode, failResult.status);
        }
        // Previous behaviour (discarded pending / set generic failed):
        // await supabaseAdmin.from('payfast_pending_payments').delete().eq('m_payment_id', registrationCode);
        // await supabaseAdmin.from('event_management_registrations').update({ payment_status: 'failed' }).eq('registration_code', registrationCode);
      }
      return responseOk;
    }

    // ── Legacy path: registration already exists (register-first PayFast flow) ──
    if (pfData.payment_status === 'COMPLETE') {
      const result = await completeEventBookingPayfast(
        supabaseAdmin,
        registrationCode,
        pfData.pf_payment_id || pfData.m_payment_id,
        'payfast-itn'
      );

      if (result.status === 'error') {
        console.error('[EB PayFast ITN] Legacy complete failed:', result.message);
      } else if (result.status === 'updated') {
        console.log('[EB PayFast ITN] Legacy registration marked paid:', registrationCode);
      }

      await maybeSendPayfastBookingConfirmationEmail(supabaseAdmin, 'event', result, 'payfast-itn');

      // Previous behaviour (direct update without confirmation email):
      // await supabaseAdmin
      //   .from('event_management_registrations')
      //   .update({
      //     payment_status: 'paid',
      //     payfast_payment_id: pfData.pf_payment_id || pfData.m_payment_id,
      //   })
      //   .eq('registration_code', registrationCode);
    } else if (pfData.payment_status === 'FAILED') {
      const failResult = await recordFailedBookingPayment(supabaseAdmin, {
        bookingType: 'event',
        mPaymentId: registrationCode,
        payfastPaymentId: pfData.pf_payment_id || null,
        testSource: 'payfast-itn',
      });
      if (failResult.status === 'error') {
        console.error('[EB PayFast ITN] Failed to record failed payment (legacy path):', failResult.message);
      }
      // Previous behaviour:
      // await supabaseAdmin.from('event_management_registrations').update({ payment_status: 'failed' }).eq('registration_code', registrationCode);
    }
  } catch (err) {
    console.error('[EB PayFast ITN] Exception:', err instanceof Error ? err.message : err);
  }

  return responseOk;
}
